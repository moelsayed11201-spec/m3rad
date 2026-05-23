import { useState, useRef } from 'react';
import { useStore, Installment, PaymentReceipt } from '@/store';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Banknote, CalendarClock, X, Check, Printer, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(amount) + ' ج.م';
};

export function Collections() {
  const { installments, contracts, customers, recordPayment, currentUser } = useStore();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);
  const [lastReceipt, setLastReceipt] = useState<PaymentReceipt | null>(null);
  
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    method: 'نقدي' as const,
    notes: ''
  });

  // Get active/late installments
  const activeInstallments = installments
    .filter(i => i.status === 'معلق' || i.status === 'متأخر' || i.status === 'مدفوع جزئياً')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const filteredInstallments = activeInstallments.filter(inst => {
    const contract = contracts.find(c => c.id === inst.contractId);
    const customer = customers.find(c => c.id === contract?.customerId);
    
    return contract?.contractNumber.includes(search) || 
           customer?.name.includes(search) ||
           customer?.nationalId.includes(search);
  });

  const totalRemaining = filteredInstallments.reduce((sum, inst) => sum + inst.remainingAmount, 0);

  const handleOpenPayment = (inst: Installment) => {
    setSelectedInstallment(inst);
    setPaymentData({
      amount: inst.remainingAmount,
      method: 'نقدي',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstallment) return;

    try {
      const receipt: any = {
        id: `rcpt-${Date.now()}`,
        installmentId: selectedInstallment.id,
        contractId: selectedInstallment.contractId,
        customerId: contracts.find(c => c.id === selectedInstallment.contractId)?.customerId || '',
        amount: paymentData.amount,
        date: new Date().toISOString(),
        method: paymentData.method,
        collector: currentUser ? currentUser.name : 'إدارة التحصيل',
        notes: paymentData.notes
      };

      await recordPayment(receipt);

      setLastReceipt(receipt);
      setIsModalOpen(false);
      setIsReceiptModalOpen(true);
      toast.success('تم تسجيل الدفعة بنجاح');
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ أثناء السداد');
    }
  };

  const printReceipt = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-heading font-bold tracking-tight">التحصيل والمتابعة</h2>
        <div className="bg-indigo-900/40 border border-indigo-500/30 px-6 py-3 rounded-2xl flex items-center gap-6 shadow-lg shadow-indigo-500/10">
          <div className="flex flex-col">
            <span className="text-xs text-indigo-300 font-medium">إجمالي المديونية المستحقة</span>
            <span className="text-2xl font-bold font-heading text-indigo-100">{formatCurrency(totalRemaining)}</span>
          </div>
          <div className="h-10 w-[1px] bg-indigo-500/20"></div>
          <div className="flex flex-col">
            <span className="text-xs text-indigo-300 font-medium">عدد الأقساط</span>
            <span className="text-2xl font-bold font-heading text-indigo-100">{filteredInstallments.length}</span>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pl-4 pr-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="بحث برقم العقد، اسم العميل، الهوية..." 
                className="pr-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="gap-1 px-3 py-1.5 cursor-pointer">
                <CalendarClock className="h-3.5 w-3.5" />
                اليوم
              </Badge>
              <Badge variant="destructive" className="gap-1 px-3 py-1.5 cursor-pointer">
                المتأخرات
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم العقد</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>تاريخ الاستحقاق</TableHead>
                <TableHead>رقم القسط</TableHead>
                <TableHead>المبلغ المستحق</TableHead>
                <TableHead>المبلغ المتبقي</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="w-[120px]">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInstallments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">لا يوجد أقساط مستحقة مطابقة</TableCell>
                </TableRow>
              ) : filteredInstallments.map((inst) => {
                const contract = contracts.find(c => c.id === inst.contractId);
                const customer = customers.find(c => c.id === contract?.customerId);
                return (
                  <TableRow key={inst.id}>
                    <TableCell className="font-medium text-indigo-400">{contract?.contractNumber}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{customer?.name}</span>
                        <span className="text-xs text-slate-500">{customer?.phone}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={inst.status === 'متأخر' ? 'text-red-500 font-bold' : 'text-slate-300'}>
                        {inst.dueDate}
                      </span>
                    </TableCell>
                    <TableCell>{inst.number} من {contract?.numberOfInstallments}</TableCell>
                    <TableCell>{formatCurrency(inst.amount)}</TableCell>
                    <TableCell className="font-bold text-white">{formatCurrency(inst.remainingAmount)}</TableCell>
                    <TableCell>
                      <Badge variant={inst.status === 'متأخر' ? 'destructive' : inst.status === 'مدفوع جزئياً' ? 'warning' : 'default'}>
                        {inst.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" className="gap-1 h-8 bg-emerald-600 hover:bg-emerald-500" onClick={() => handleOpenPayment(inst)}>
                        <Banknote className="h-3.5 w-3.5" />
                        سداد
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-400" /> تسجيل عملية سداد
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleConfirmPayment} className="space-y-4 py-4">
            <div className="bg-white/5 p-4 rounded-lg space-y-2 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">العميل:</span>
                <span className="font-medium text-white">{customers.find(c => c.id === (contracts.find(ct => ct.id === selectedInstallment?.contractId)?.customerId))?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">المبلغ المستحق للقسط:</span>
                <span className="font-medium text-indigo-300">{selectedInstallment && formatCurrency(selectedInstallment.remainingAmount)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pay-amount">المبلغ المدفوع (ج.م)</Label>
              <Input 
                id="pay-amount" 
                type="number" 
                required 
                value={paymentData.amount} 
                max={selectedInstallment?.remainingAmount}
                onChange={e => setPaymentData({...paymentData, amount: parseFloat(e.target.value) || 0})}
                className=" focus:ring-emerald-500"
              />
              <p className="text-[10px] text-slate-500">يمكنك سداد جزء من المبلغ أو المبلغ بالكامل</p>
            </div>

            {selectedInstallment && (
              <div className="bg-slate-50 p-3 rounded-md border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700 space-y-2 mt-4 text-sm mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">المبلغ المتبقي بعد السداد:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {formatCurrency(Math.max(0, selectedInstallment.remainingAmount - (paymentData.amount || 0)))}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">حالة القسط بعد السداد:</span>
                  <Badge variant={selectedInstallment.remainingAmount - (paymentData.amount || 0) <= 0 ? 'default' : 'warning'}>
                    {selectedInstallment.remainingAmount - (paymentData.amount || 0) <= 0 ? 'مدفوع' : 'مدفوع جزئياً'}
                  </Badge>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="pay-method">طريقة السداد</Label>
              <select 
                id="pay-method"
                className="flex h-10 w-full rounded-md bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={paymentData.method}
                onChange={(e) => setPaymentData({...paymentData, method: e.target.value as any})}
              >
                <option value="نقدي">نقدي</option>
                <option value="تحويل بنكي">تحويل بنكي</option>
                <option value="بطاقة ائتمان">بطاقة ائتمان</option>
                <option value="شيك">شيك</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <Input 
                id="notes" 
                value={paymentData.notes} 
                onChange={e => setPaymentData({...paymentData, notes: e.target.value})} 
                className="" 
                placeholder="رقم العملية، اسم المودع، إلخ..."
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>إلغاء</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 gap-2">
                <Check className="h-4 w-4" /> تأكيد السداد
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white text-slate-900 print:max-w-none print:w-full print:border-none print:shadow-none print:m-0 print:p-0">
          <DialogHeader className="print:hidden">
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Check className="h-5 w-5 text-emerald-600" /> تم السداد بنجاح
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-6 border border-slate-200 rounded-lg print:border-none print:p-0">
            <div className="text-center mb-6 border-b border-slate-200 pb-4">
              <h3 className="text-xl font-bold font-heading">سند قبض</h3>
              <p className="text-sm text-slate-500 mt-1">سحابي لادارة المعارض</p>
            </div>
            
            {lastReceipt && (
              <div className="space-y-4 text-sm">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-500">رقم الإيصال</span>
                  <span className="font-mono font-bold text-slate-900">{lastReceipt.id}</span>
                </div>
                
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-500">التاريخ</span>
                  <span className="text-slate-900 flex items-center gap-2">
                    <span className="text-slate-400 text-xs">{new Date(lastReceipt.date).toLocaleTimeString('ar-EG')}</span>
                    {new Date(lastReceipt.date).toLocaleDateString('ar-EG')}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-500">اسم العميل</span>
                  <span className="font-medium text-slate-900">
                    {customers.find(c => c.id === lastReceipt.customerId)?.name}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-500">رقم العقد</span>
                  <span className="font-mono text-slate-900">
                    {contracts.find(c => c.id === lastReceipt.contractId)?.contractNumber}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-500">المبلغ المدفوع</span>
                  <span className="font-bold text-emerald-600 text-lg">
                    {formatCurrency(lastReceipt.amount)}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-500">طريقة الدفع</span>
                  <span className="text-slate-900">{lastReceipt.method}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-500">المحصل</span>
                  <span className="text-slate-900">{lastReceipt.collector}</span>
                </div>

                {lastReceipt.notes && (
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="text-slate-500">ملاحظات</span>
                    <span className="text-slate-900">{lastReceipt.notes}</span>
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
              <p>شكراً لتعاملكم معنا</p>
              <p dir="ltr" className="mt-1">Generated by Qeist ERP</p>
            </div>
          </div>

          <DialogFooter className="pt-4 print:hidden gap-2">
            <DialogClose className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 text-slate-600">
              إغلاق
            </DialogClose>
            <Button onClick={printReceipt} className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2">
              <Printer className="h-4 w-4" /> طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
