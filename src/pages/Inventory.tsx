import { useState, useEffect } from 'react';
import { useStore, Product } from '@/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Package, Search, Plus, Edit, Trash2, ArrowUpRight, ArrowDownRight, RefreshCcw, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FinanceService } from '@/lib/finance';
import { Alert, AlertDescription } from '@/components/ui/alert';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

export function Inventory() {
  const { currentUser, products, productCategories = [], addProduct, updateProduct, deleteProduct, inventoryMovements, suppliers = [], branches = [] } = useStore();
  const isCEO = currentUser?.role === 'ceo';
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [recordExpense, setRecordExpense] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    manufacturer: '',
    price: 0,
    costPrice: 0,
    cashPrice: 0,
    stock: 0,
    lowStockThreshold: 5,
    supplierId: '',
    supplier: '',
    notes: '',
    barcode: '',
    branchId: ''
  });

  useEffect(() => {
    if (!formData.branchId && !editingProduct) {
      const defaultBranch = currentUser?.branchIds && currentUser.branchIds.length > 0
        ? currentUser.branchIds[0]
        : (branches && branches.length > 0 ? branches[0].id : '');
      if (defaultBranch) {
        setFormData(prev => ({ ...prev, branchId: defaultBranch }));
      }
    }
  }, [branches, currentUser, formData.branchId, editingProduct]);

  const defaultCategories = ['شاشات', 'ثلاجات', 'غسالات', 'بوتاجازات', 'ديب فريزر', 'تكييفات', 'سخانات', 'مكانس كهربائية', 'موبايلات', 'لابتوبات', 'أجهزة صغيرة', 'إكسسوارات', 'أخرى'];
  const manufacturers = ['توشيبا (Toshiba)', 'فريش (Fresh)', 'شارب (Sharp)', 'إل جي (LG)', 'سامسونج (Samsung)', 'يونيون آير (UnionAire)', 'كريازي (Kiriazi)', 'بيكو (Beko)', 'زانوسي (Zanussi)', 'تيفال (Tefal)', 'أخرى'];
  const dbCategories = (productCategories || []).filter((c: any) => c.isActive).map((c: any) => c.name);
  const productsCategories = products.map((p: any) => p.category).filter(Boolean);
  const activeCategories = Array.from(new Set([...defaultCategories, ...dbCategories, ...productsCategories]));

  const filteredProducts = products.filter((p: any) => 
    p.name.includes(search) || 
    p.category.includes(search) ||
    p.barcode?.includes(search)
  );

  const getProfitInfo = (p: Product) => {
    if (!p.costPrice || p.costPrice <= 0) {
      return { profit: 'غير محسوب', percent: '0', isWarning: true };
    }
    const profit = (p.price || 0) - p.costPrice;
    const percent = ((profit / p.costPrice) * 100).toFixed(1);
    return { profit: profit.toLocaleString(), percent, isWarning: false };
  };

  const filteredMovements = inventoryMovements.filter(m => {
    const product = products.find(p => p.id === m.productId);
    return product?.name.includes(search) || product?.barcode.includes(search) || m.notes?.includes(search);
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validation
    if (!formData.name) return setError('الرجاء إدخال اسم المنتج');
    if (!formData.category) return setError('الرجاء اختيار أو إدخال تصنيف');
    if (!formData.branchId) return setError('الرجاء اختيار فرع للمنتج');
    if (formData.cashPrice <= 0) return setError('الرجاء إدخال السعر الأساسي للبيع');
    if (formData.costPrice < 0) return setError('سعر التكلفة لا يمكن أن يكون سالباً');
    if (formData.stock < 0) return setError('الكمية المخزنية لا يمكن أن تكون سالبة');
    
    if (formData.costPrice > 0 && formData.cashPrice < formData.costPrice) {
      if (!window.confirm('تنبيه: سعر التكلفة أعلى من سعر البيع. هل أنت متأكد؟')) return;
    }

    if (!window.confirm('هل أنت متأكد من حفظ بيانات المنتج؟')) return;

    setIsSaving(true);
    try {
      const product: any = {
        id: editingProduct?.id || `prod-${Date.now()}`,
        ...formData,
        price: formData.cashPrice // We save it as cashPrice, installment price calculated in NewContract
      };

      if (editingProduct) {
        await updateProduct(product);
        if (recordExpense && product.stock > (editingProduct.stock || 0)) {
          const addedQuantity = product.stock - (editingProduct.stock || 0);
          await useStore.getState().addExpense({
            id: `exp-pur-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: `شراء مخزون - ${product.name}`,
            category: 'مشتريات للمخزون',
            amount: (product.costPrice || 0) * addedQuantity,
            date: new Date().toISOString().split('T')[0],
            paymentMethod: 'نقدي',
            notes: `زيادة رصيد المخزن بمقدار ${addedQuantity}`,
            type: 'out',
            branchId: product.branchId,
            referenceId: product.id
          } as any);
        }
        toast.success('تم تحديث المنتج بنجاح');
      } else {
        await addProduct(product);
        if (recordExpense && product.stock > 0) {
          await useStore.getState().addExpense({
            id: `exp-new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: `شراء مخزون (جديد) - ${product.name}`,
            category: 'مشتريات للمخزون',
            amount: (product.costPrice || 0) * product.stock,
            date: new Date().toISOString().split('T')[0],
            paymentMethod: 'نقدي',
            notes: 'تسجيل منتج جديد برصيد افتتاحي',
            type: 'out',
            branchId: product.branchId,
            referenceId: product.id
          } as any);
        }
        toast.success('تم إضافة المنتج بنجاح');
      }

      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      console.error('Failed to save product:', err);
      setError(`فشل الحفظ: ${err?.message || 'خطأ في قاعدة البيانات'}`);
      toast.error('حدث خطأ أثناء محاولة الحفظ في قاعدة البيانات');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category || '',
      manufacturer: product.manufacturer || '',
      price: product.price || 0,
      costPrice: product.costPrice || 0,
      cashPrice: product.cashPrice || 0,
      stock: product.stock || 0,
      lowStockThreshold: product.lowStockThreshold || 5,
      supplierId: product.supplierId || '',
      supplier: product.supplier || '',
      notes: product.notes || '',
      barcode: product.barcode || '',
      branchId: product.branchId || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
      deleteProduct(id);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      manufacturer: '',
      price: 0,
      costPrice: 0,
      cashPrice: 0,
      stock: 0,
      lowStockThreshold: 5,
      supplierId: '',
      supplier: '',
      notes: '',
      barcode: '',
      branchId: currentUser?.branchIds && currentUser.branchIds.length > 0
        ? currentUser.branchIds[0]
        : (branches && branches.length > 0 ? branches[0].id : '')
    });
    setEditingProduct(null);
    setRecordExpense(false);
  };

  const exportProductsToExcel = () => {
    if (currentUser?.role === 'employee') {
      toast.error('عذراً، موظفو المبيعات لا يمكنهم تصدير قوائم المنتجات.');
      return;
    }

    const confirmExport = window.confirm('قد يحتوي هذا الملف على بيانات مالية حساسة. هل أنت متأكد من رغبتك في التصدير؟');
    if (!confirmExport) return;

    try {
      const data = filteredProducts.map(p => ({
        'اسم المنتج': p.name,
        'المورد': suppliers.find((s: any) => s.id === p.supplierId)?.name || p.supplier || 'غير محدد',
        'الشركة المصنعة': p.manufacturer || 'غير محدد',
        'التصنيف': p.category,
        'الباركود': p.barcode || '-',
        'سعر التكلفة': p.costPrice,
        'السعر الأساسي (نقدي)': p.cashPrice,
        'الكمية بالمخزن': p.stock,
        'حد التنبيه': p.lowStockThreshold || 5,
        'ملاحظات': p.notes || '-'
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'المنتجات');
      XLSX.writeFile(wb, `تقرير_المخزون_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('تم تصدير قائمة المنتجات إلى Excel بنجاح');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('حدث خطأ أثناء تصدير البيانات');
    }
  };

  const exportMovementsToExcel = () => {
    if (currentUser?.role === 'employee') {
      toast.error('عذراً، موظفو المبيعات لا يمكنهم تصدير حركة المخزون.');
      return;
    }

    const confirmExport = window.confirm('قد يحتوي هذا الملف على بيانات حساسة. هل أنت متأكد من رغبتك في التصدير؟');
    if (!confirmExport) return;

    try {
      const data = filteredMovements.map(m => {
        const product = products.find(p => p.id === m.productId);
        return {
          'المنتจ': product?.name || 'منتج محذوف',
          'نوع الحركة': m.type === 'in' ? 'إضافة/وارد' : 'صرف/مبيعات',
          'الكمية': m.quantity,
          'التاريخ': new Date(m.date).toLocaleString('ar-EG'),
          'ملاحظات': m.notes || '-'
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'حركات_المخزون');
      XLSX.writeFile(wb, `تقرير_حركات_المخزون_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('تم تصدير حركات المخزون إلى Excel بنجاح');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('حدث خطأ أثناء تصدير البيانات');
    }
  };

  return (
    <div className="space-y-6 flex flex-col min-h-0 h-full max-h-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2 text-slate-100">
          <Package className="h-6 w-6 text-indigo-400" />
          <h2 className="text-2xl font-heading font-bold tracking-tight">إدارة المخزون</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 border-indigo-500/30 text-indigo-400 hover:bg-slate-800" onClick={exportProductsToExcel}>
            <FileSpreadsheet className="h-4 w-4" />
            <span>تصدير Excel</span>
          </Button>
          <Button className="gap-2" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4" />
            <span>إضافة منتج</span>
          </Button>
        </div>
      </div>

      <div className="relative flex-1 max-w-sm shrink-0">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input 
          placeholder="بحث في المخزون أو الحركات..." 
          className="pr-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Tabs defaultValue="products" className="w-full flex-1 flex flex-col min-h-0">
        <TabsList className="w-fit mb-4 shrink-0">
          <TabsTrigger value="products">المنتجات</TabsTrigger>
          <TabsTrigger value="movements">حركة المخزون</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2 mb-4 shrink-0 px-1">
          <TabsContent value="movements">
             <Button variant="outline" size="sm" className="gap-2 border-indigo-500/30 text-indigo-300" onClick={exportMovementsToExcel}>
                <FileSpreadsheet className="h-3 w-3" /> تصدير حركات المخزون Excel
             </Button>
          </TabsContent>
        </div>
        <div className="flex-1 overflow-auto">
          <TabsContent value="products" className="m-0 h-full">
            <Card className="h-full flex flex-col">
              <CardContent className="p-0 flex-1 overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-900 border-b border-white/10 z-10">
                    <TableRow>
                      <TableHead>المنتج</TableHead>
                      <TableHead>المورد</TableHead>
                      <TableHead>الشركة المصنعة</TableHead>
                      <TableHead>التصنيف</TableHead>
                      <TableHead>الباركود</TableHead>
                      {isCEO && <TableHead>سعر التكلفة</TableHead>}
                      <TableHead>السعر الأساسي (نقدي)</TableHead>
                      <TableHead>الكمية بالمخزن</TableHead>
                      <TableHead>الحالة</TableHead>
                      {isCEO && <TableHead className="w-[120px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isCEO ? 9 : 7} className="text-center py-8 text-slate-400">لا يوجد منتجات مطابقة</TableCell>
                      </TableRow>
                    ) : filteredProducts.map((p) => {
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium text-slate-200">
                            <span>{p.name}</span>
                          </TableCell>
                          <TableCell className="text-slate-400 text-xs">
                            {p.supplierId ? (
                              <Badge variant="outline" className="bg-indigo-500/5 text-indigo-400 border-indigo-500/20">
                                {suppliers.find((s: any) => s.id === p.supplierId)?.name || p.supplier || 'غير محدد'}
                              </Badge>
                            ) : (
                              <span className="text-slate-500">{p.supplier || 'غير محدد'}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-300">
                            <Badge variant="outline" className="border-indigo-500/30 text-indigo-300">
                              {p.manufacturer || 'غير محدد'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-300">{p.category}</TableCell>
                          <TableCell className="text-slate-500 font-mono text-xs">{p.barcode}</TableCell>
                          {isCEO && (
                            <TableCell className="text-slate-400">
                              {FinanceService.formatCurrency(p.costPrice || 0)}
                            </TableCell>
                          )}
                          <TableCell className="text-emerald-400 font-bold">{FinanceService.formatCurrency(p.cashPrice || 0)}</TableCell>
                          <TableCell className="font-bold">{p.stock}</TableCell>
                          <TableCell>
                            <Badge variant={p.stock > (p.lowStockThreshold || 5) ? 'success' : p.stock > 0 ? 'warning' : 'destructive'}>
                              {p.stock > (p.lowStockThreshold || 5) ? 'متوفر' : p.stock > 0 ? 'كمية قليلة' : 'نفذت الكمية'}
                            </Badge>
                          </TableCell>
                        {isCEO && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-rose-500 hover:text-rose-600" onClick={() => handleDelete(p.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="movements" className="m-0 h-full">
            <Card className="h-full flex flex-col">
              <CardContent className="p-0 flex-1 overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-900 border-b border-white/10 z-10">
                    <TableRow>
                      <TableHead>المنتج</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الكمية</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>المستخدم</TableHead>
                      <TableHead>ملاحظات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMovements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-400">لا يوجد حركات مسجلة</TableCell>
                      </TableRow>
                    ) : filteredMovements.map((m) => {
                      const product = products.find(p => p.id === m.productId);
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium text-slate-200">
                            {product?.name || 'منتج محذوف'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                                m.type === 'in' ? 'border-emerald-500/50 text-emerald-400' :
                                m.type === 'out' ? 'border-amber-500/50 text-amber-400' :
                                'border-indigo-500/50 text-indigo-400'
                              }>
                              <div className="flex items-center gap-1">
                                {m.type === 'in' && <ArrowDownRight className="h-3 w-3" />}
                                {m.type === 'out' && <ArrowUpRight className="h-3 w-3" />}
                                {m.type === 'in' ? 'إضافة/وارد' : 'صرف/مبيعات'}
                              </div>
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold">
                            {m.type === 'in' ? '+' : m.type === 'out' ? '-' : ''}{m.quantity}
                          </TableCell>
                          <TableCell>{new Date(m.date).toLocaleString('ar-EG')}</TableCell>
                          <TableCell>النظام</TableCell>
                          <TableCell className="text-slate-400 text-sm max-w-[200px] truncate" title={m.notes}>{m.notes}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={isModalOpen} onOpenChange={(open) => { if(!open) resetForm(); setIsModalOpen(open); }}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive" className="bg-rose-500/10 border-rose-500/20 text-rose-500">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="p-name">اسم المنتج</Label>
              <Input id="p-name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-branch">الفرع المراد إضافة المنتج فيه</Label>
              <select 
                id="p-branch" 
                required 
                disabled={!isCEO}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-900 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300"
                value={formData.branchId}
                onChange={e => setFormData({...formData, branchId: e.target.value})}
              >
                <option value="">اختر فرعاً...</option>
                {(branches || []).filter((b: any) => b.isActive && !b.isDeleted).map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {!isCEO && (
                <p className="text-[11px] text-slate-500 font-sans">تتم إضافة المنتجات لفرعك الحالي تلقائياً.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manufacturer">الشركة المصنعة</Label>
                <div className="relative">
                  <Input 
                    id="manufacturer" 
                    value={formData.manufacturer} 
                    onChange={e => setFormData({...formData, manufacturer: e.target.value})}
                    list="manufacturer-options"
                    autoComplete="off"
                    placeholder="اختر أو اكتب الشركة..."
                  />
                  <datalist id="manufacturer-options">
                    {manufacturers.map((m: string) => <option key={m} value={m} />)}
                  </datalist>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">التصنيف</Label>
                <div className="relative">
                  <Input 
                    id="category" 
                    required 
                    value={formData.category} 
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    list="category-options"
                    autoComplete="off"
                    placeholder="اختر أو اكتب تصنيفاً..."
                  />
                  <datalist id="category-options">
                    {activeCategories.map((cat: string) => <option key={cat} value={cat} />)}
                  </datalist>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="barcode">الباركود</Label>
                <Input id="barcode" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="costPrice">سعر التكلفة (ج.م)</Label>
                <Input id="costPrice" type="number" required value={formData.costPrice} onChange={e => setFormData({...formData, costPrice: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cashPrice">السعر الأساسي للبيع (نقدي) (ج.م)</Label>
                <Input id="cashPrice" type="number" required value={formData.cashPrice} onChange={e => setFormData({...formData, cashPrice: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">الكمية بالمخزن</Label>
                <Input id="stock" type="number" required value={formData.stock} onChange={e => setFormData({...formData, stock: parseInt(e.target.value) || 0})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lowStockThreshold">حد التنبيه للمخزون</Label>
                <Input id="lowStockThreshold" type="number" required value={formData.lowStockThreshold} onChange={e => setFormData({...formData, lowStockThreshold: parseInt(e.target.value) || 0})} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="supplierId">المورد</Label>
                  <Button 
                    type="button" 
                    variant="link" 
                    className="h-auto p-0 text-xs text-indigo-400 hover:text-indigo-300"
                    onClick={() => {
                        setIsModalOpen(false);
                        window.location.hash = '#/suppliers'; // Simple routing fallback or just help them find it
                        // Since we use React Router, we should probably use navigate but simple hash might work or just a tip
                    }}
                  >
                    إدارة الموردين
                  </Button>
                </div>
                <select 
                  id="supplierId"
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-900 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300"
                  value={formData.supplierId}
                  onChange={e => {
                    const supId = e.target.value;
                    const supName = suppliers.find((s: any) => s.id === supId)?.name || '';
                    if (supId === 'other') {
                        setFormData({...formData, supplierId: 'other', supplier: ''});
                    } else {
                        setFormData({...formData, supplierId: supId, supplier: supName});
                    }
                  }}
                >
                  <option value="">اختر مورداً من القائمة...</option>
                  {(suppliers || []).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                  <option value="other">-- كتابة مورد غير مسجل --</option>
                </select>
                <p className="text-[10px] text-slate-500">يجب إضافة المورد أولاً من قسم "الموردين" ليظهر في هذه القائمة.</p>
              </div>
              {formData.supplierId === 'other' && (
                <div className="space-y-2">
                  <Label htmlFor="supplier">اسم المورد (كتابة يدوية)</Label>
                  <Input id="supplier" placeholder="أدخل اسم المورد هنا..." value={formData.supplier} onChange={e => setFormData({...formData, supplier: e.target.value})} />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <Input id="notes" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="recordExpense" checked={recordExpense} onChange={e => setRecordExpense(e.target.checked)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 bg-white dark:bg-slate-900" />
              <Label htmlFor="recordExpense" className="cursor-pointer text-sm">تسجيل مصروفات المشتريات تلقائياً للمخزون بـ (سعر التكلفة)</Label>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isSaving}>إلغاء</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500" disabled={isSaving}>
                {isSaving ? 'جاري الحفظ...' : 'حفظ المنتج'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
