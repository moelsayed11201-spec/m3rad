import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Calculator, Save, AlertCircle, Plus, Trash2, ShoppingCart, Loader2 } from 'lucide-react';
import { Contract, ContractItem } from '@/store';
import { FinanceService, InstallmentPreview } from '@/lib/finance';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

export function NewContract() {
  const navigate = useNavigate();
  const { currentUser, customers, products, addContract, settings } = useStore() as any;
  const isAdmin = currentUser?.role === 'admin';
  
  const [formData, setFormData] = useState({
    customerId: '',
    downPayment: 0,
    startDate: new Date().toISOString().split('T')[0],
    frequency: 'شهري',
    numberOfInstallments: 12,
    contractType: 'تقسيط' as 'تقسيط' | 'نقدي',
  });

  const [items, setItems] = useState<ContractItem[]>([]);
  const [currentProduct, setCurrentProduct] = useState({ id: '', quantity: 1 });
  
  const [preview, setPreview] = useState<InstallmentPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const getMonthlyProfitRate = (months: number) => {
    let totalRate = 25;
    if (months <= 3) totalRate = parseFloat(settings?.profitRate3 || '10');
    else if (months <= 6) totalRate = parseFloat(settings?.profitRate6 || '15');
    else if (months <= 12) totalRate = parseFloat(settings?.profitRate12 || '25');
    else if (months <= 18) totalRate = parseFloat(settings?.profitRate18 || '35');
    else if (months <= 24) totalRate = parseFloat(settings?.profitRate24 || '45');
    else totalRate = parseFloat(settings?.profitRate36 || '60');

    return (totalRate / months) / 100;
  };

  const addItem = () => {
    setError(null);
    const product = products.find((p: any) => p.id === currentProduct.id);
    if (!product) return setError('يرجى اختيار المنتج أولاً');
    if (currentProduct.quantity <= 0) return setError('الكمية يجب أن تكون أكبر من صفر');
    if (currentProduct.quantity > (product.stock || 0)) {
      return setError(`الكمية غير متوفرة. المتاح: ${product.stock}`);
    }

    const existingIdx = items.findIndex(item => item.productId === currentProduct.id);
    if (existingIdx > -1) {
      const newItems = [...items];
      newItems[existingIdx].quantity += currentProduct.quantity;
      setItems(newItems);
    } else {
      setItems([...items, {
        productId: product.id,
        quantity: currentProduct.quantity,
        productPrice: product.cashPrice || 0
      }]);
    }
    setCurrentProduct({ id: '', quantity: 1 });
    setPreview(null);
  };

  const removeItem = (productId: string) => {
    setItems(items.filter(item => item.productId !== productId));
    setPreview(null);
  };

  const calculateInstallments = () => {
    setError(null);
    if (!formData.customerId) return setError('يرجى اختيار العميل');
    if (items.length === 0) return setError('الرجاء إضافة منتجات للسلة أولاً');

    const totalBasePrice = FinanceService.calculateSubtotal(items);
    const actualDownPayment = formData.contractType === 'نقدي' ? totalBasePrice : formData.downPayment;
    const installments = formData.contractType === 'نقدي' ? 0 : formData.numberOfInstallments;
    const financed = FinanceService.calculateFinancedAmount(totalBasePrice, actualDownPayment);

    // Validate financials
    const valResult = FinanceService.validateContractFinancials({
      contractType: formData.contractType,
      subtotal: totalBasePrice,
      downPayment: actualDownPayment,
      financedAmount: financed,
      numberOfInstallments: installments
    });

    if (!valResult.isValid) {
      return setError(valResult.error || 'خطأ في البيانات المالية');
    }

    const result = FinanceService.calculateContract(
      totalBasePrice,
      actualDownPayment,
      installments,
      settings
    );

    setPreview(result);
  };

  const handleSave = async () => {
    if (!preview) return;
    if (!window.confirm('هل أنت متأكد من الحفظ؟')) return;

    setIsSaving(true);
    setError(null);
    try {
      const contract: any = {
        id: `ctr-${Date.now()}`,
        contractNumber: formData.contractType === 'نقدي' ? `INV-${Date.now().toString().slice(-6)}` : `CTR-${Date.now().toString().slice(-6)}`,
        customerId: formData.customerId,
        items: items,
        totalContractAmount: preview.totalContractAmount,
        downPayment: formData.contractType === 'نقدي' ? preview.totalContractAmount : formData.downPayment,
        financedAmount: preview.financedAmount,
        interestRate: preview.interestRate,
        totalInterest: preview.totalInterest,
        adminFees: 0,
        startDate: formData.startDate,
        frequency: formData.frequency as any,
        numberOfInstallments: formData.contractType === 'نقدي' ? 0 : formData.numberOfInstallments,
        installmentAmount: preview.installmentAmount,
        status: formData.contractType === 'نقدي' ? 'مكتمل' : 'نشط',
        contractType: formData.contractType
      };

      await addContract(contract);
      toast.success(formData.contractType === 'نقدي' ? 'تم إصدار الفاتورة وحفظها بنجاح' : 'تم إصدار العقد وجدولته بنجاح');
      navigate('/contracts');
    } catch (err: any) {
      console.error('Failed to save contract:', err);
      setError(`فشل حفظ العملية: ${err?.message || 'خطأ غير معروف'}`);
      toast.error('حدث خطأ أثناء حفظ الفاتورة/العقد في قاعدة البيانات');
    } finally {
      setIsSaving(false);
    }
  };

  const totalBasePrice = items.reduce((acc, item) => acc + (item.productPrice * item.quantity), 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/contracts')}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <h2 className="text-2xl font-heading font-bold tracking-tight">عملية شراء جديدة</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">بيانات العملية</CardTitle>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-white/5">
                <button 
                  type="button"
                  onClick={() => { setFormData({...formData, contractType: 'تقسيط'}); setPreview(null); }}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${formData.contractType === 'تقسيط' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  بيع تقسيط
                </button>
                <button 
                  type="button"
                  onClick={() => { setFormData({...formData, contractType: 'نقدي'}); setPreview(null); }}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${formData.contractType === 'نقدي' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  بيع نقدي (كاش)
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-rose-500/10 border-rose-500/20 text-rose-500">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label>تحديد العميل</Label>
                <select 
                  className="flex h-10 w-full rounded-md bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={formData.customerId}
                  onChange={(e) => setFormData({...formData, customerId: e.target.value})}
                >
                  <option value="">اختر عميل...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="border-t border-white/5 pt-4 space-y-4">
                <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" /> سلة المنتجات
                </h3>
                <div className="grid grid-cols-5 gap-2 items-end">
                  <div className="col-span-3 space-y-1">
                    <Label className="text-xs">المنتج</Label>
                    <select 
                      className="flex h-10 w-full rounded-md bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm"
                      value={currentProduct.id}
                      onChange={(e) => setCurrentProduct({...currentProduct, id: e.target.value})}
                    >
                      <option value="">اختر منتج...</option>
                      {products.filter((p: any) => p.stock > 0).map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.stock}) - {FinanceService.formatCurrency(p.cashPrice)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1 space-y-1">
                    <Label className="text-xs">الكمية</Label>
                    <Input type="number" min="1" value={currentProduct.quantity} onChange={(e) => setCurrentProduct({...currentProduct, quantity: parseInt(e.target.value) || 1})} />
                  </div>
                  <div className="col-span-1">
                    <Button type="button" variant="outline" className="w-full text-indigo-400 border-indigo-500/30" onClick={addItem}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {items.length > 0 && (
                  <div className="rounded-lg border border-white/5 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-white/5">
                        <TableRow>
                          <TableHead className="text-xs">المنتج</TableHead>
                          <TableHead className="text-xs">السعر</TableHead>
                          <TableHead className="text-xs">الكمية</TableHead>
                          <TableHead className="text-xs text-left">الإجمالي</TableHead>
                          <TableHead className="w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, idx) => {
                          const p = products.find(prod => prod.id === item.productId);
                          return (
                            <TableRow key={idx}>
                              <TableCell className="text-sm">{p?.name}</TableCell>
                              <TableCell className="text-sm">{FinanceService.formatCurrency(item.productPrice)}</TableCell>
                              <TableCell className="text-sm">{item.quantity}</TableCell>
                              <TableCell className="text-sm text-left font-bold">{FinanceService.formatCurrency(item.productPrice * item.quantity)}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-400" onClick={() => removeItem(item.productId)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    <div className="p-3 bg-white/5 text-left font-bold border-t border-white/5">
                      الإجمالي الأساسي: {FinanceService.formatCurrency(totalBasePrice)}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                <div className="space-y-2">
                  <Label>تاريخ العملية</Label>
                  <Input type="date" value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} />
                </div>
                {formData.contractType === 'تقسيط' && (
                  <div className="space-y-2">
                    <Label>عدد الأقساط</Label>
                    <select 
                      className="flex h-10 w-full rounded-md bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm"
                      value={formData.numberOfInstallments}
                      onChange={(e) => { setFormData({...formData, numberOfInstallments: parseInt(e.target.value) || 12}); setPreview(null); }}
                    >
                      {[3, 6, 12, 18, 24, 36].map(m => <option key={m} value={m}>{m} شهر</option>)}
                    </select>
                  </div>
                )}
                {formData.contractType === 'تقسيط' && (
                  <div className="space-y-2">
                    <Label>الدفعة المقدمة (ج.م)</Label>
                    <Input type="number" min="0" value={formData.downPayment} onChange={(e) => { setFormData({...formData, downPayment: parseFloat(e.target.value) || 0}); setPreview(null); }} />
                  </div>
                )}
              </div>

              <div className="pt-4">
                <Button type="button" onClick={calculateInstallments} className={`w-full gap-2 transition-all ${formData.contractType === 'نقدي' ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-600' : 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-600'} hover:text-white`} variant="outline">
                  <Calculator className="h-4 w-4" />
                  {formData.contractType === 'نقدي' ? 'تأكيد وحساب الفاتورة' : 'حساب جدولة الأقساط'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-1">
          <Card className={`sticky top-24 border ${formData.contractType === 'نقدي' ? 'bg-emerald-600/10 border-emerald-500/20' : 'bg-indigo-600/10 border-indigo-500/20'}`}>
            <CardHeader><CardTitle className={`text-lg ${formData.contractType === 'نقدي' ? 'text-emerald-300' : 'text-indigo-300'}`}>{formData.contractType === 'نقدي' ? 'ملخص الفاتورة' : 'ملخص التمويل'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {preview ? (
                <>
                  <div className="flex justify-between text-sm"><span className="text-slate-400">الإجمالي {formData.contractType === 'تقسيط' && 'بالفائدة'}</span><span className="font-bold">{FinanceService.formatCurrency(preview.totalContractAmount)}</span></div>
                  {isAdmin && (
                    <div className="flex justify-between text-sm"><span className="text-slate-400">إجمالي الربح</span><span className="font-medium text-emerald-400">+{FinanceService.formatCurrency(preview.totalInterest)}</span></div>
                  )}
                  {formData.contractType === 'تقسيط' && (
                    <>
                      <div className="flex justify-between text-sm"><span className="text-slate-400">المقدم</span><span className="font-medium text-rose-400">-{FinanceService.formatCurrency(formData.downPayment)}</span></div>
                      <div className="flex justify-between text-base pt-2 border-t border-white/10"><span className="text-slate-400">المبلغ الممول</span><span className="font-bold">{FinanceService.formatCurrency(preview.financedAmount)}</span></div>
                      <div className="mt-6 p-4 bg-indigo-500/20 rounded-lg text-center border border-indigo-500/20">
                        <div className="text-xs text-indigo-300 mb-1">القسط الشهري</div>
                        <div className="text-3xl font-bold font-heading text-indigo-100">{FinanceService.formatCurrency(preview.installmentAmount)}</div>
                        <div className="text-xs text-indigo-400 mt-1">لمدة {formData.numberOfInstallments} شهر</div>
                      </div>
                    </>
                  )}
                  {formData.contractType === 'نقدي' && (
                    <div className="mt-6 p-4 bg-emerald-500/20 rounded-lg text-center border border-emerald-500/20">
                      <div className="text-2xl font-bold font-heading text-emerald-100">{FinanceService.formatCurrency(preview.totalContractAmount)}</div>
                      <div className="text-xs text-emerald-400 mt-1">دفع نقدي كاش</div>
                    </div>
                  )}
                  <Button 
                    className={`w-full mt-4 gap-2 ${formData.contractType === 'نقدي' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'}`} 
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>جاري الحفظ...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        <span>{formData.contractType === 'نقدي' ? 'إصدار الفاتورة' : 'إصدار العقد'}</span>
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <div className="text-center py-12 text-slate-400 text-sm">أضف منتجات للسلة ثم اضغط "حساب"</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
