import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Printer, Download, User, Package, Calendar, Banknote } from 'lucide-react';

import { FinanceService } from '@/lib/finance';

export function ContractDetail() {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const { contracts, customers, products, installments } = useStore() as any;

  const contract = contracts.find((c: any) => c.id === contractId);
  const customer = customers.find((c: any) => c.id === contract?.customerId);
  const product = products.find((p: any) => p.id === contract?.productId);
  const contractInstallments = installments.filter((i: any) => i.contractId === contractId);

  if (!contract) {
    return <div className="text-center py-12">العقد غير موجود</div>;
  }

  const isCash = contract.contractType === 'نقدي' || contract.numberOfInstallments === 0;
  const paidAmount = isCash ? contract.totalContractAmount : contractInstallments.reduce((acc: number, curr: any) => acc + curr.paidAmount, 0);
  const remainingTotal = contract.totalContractAmount - paidAmount;

  const contractItems = contract.items || (contract.productId ? [{ productId: contract.productId, quantity: contract.quantity || 1, productPrice: contract.productPrice || 0 }] : []);

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/contracts')}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <h2 className="text-2xl font-heading font-bold tracking-tight">
            {isCash ? 'تفاصيل الفاتورة النقدية' : 'تفاصيل عقد التقسيط'}: {contract.contractNumber}
          </h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> طباعة
          </Button>
        </div>
      </div>
      
      <div className="hidden print:block text-center text-2xl font-bold mb-4">
        {isCash ? 'فاتورة مبيعات نقدية' : 'عقد تمويل ومبيعات'} رقم {contract.contractNumber}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-indigo-400" /> بيانات العميل
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">الاسم:</span>
              <span className="font-medium text-white underline cursor-pointer" onClick={() => navigate(`/customers/${customer?.id}`)}>{customer?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">رقم الهوية:</span>
              <span className="font-medium">{customer?.nationalId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">رقم الجوال:</span>
              <span className="font-medium">{customer?.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">تاريخ العملية:</span>
              <span className="font-medium">{contract.startDate}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Banknote className="h-5 w-5 text-amber-400" /> ملخص مالي
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">{isCash ? 'إجمالي الفاتورة' : 'إجمالي البيع'}:</span>
              <span className="font-bold">{FinanceService.formatCurrency(contract.totalContractAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">المدفوع:</span>
              <span className="font-medium text-emerald-400">{FinanceService.formatCurrency(paidAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-white/5 pt-2">
              <span className="text-slate-400 font-bold">المتبقي:</span>
              <span className={`font-bold ${remainingTotal <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {remainingTotal <= 0 ? (isCash ? 'مسدد بالكامل' : 'عقد مكتمل') : FinanceService.formatCurrency(remainingTotal)}
              </span>
            </div>
            {!isCash && (
               <div className="flex justify-between">
                <span className="text-slate-400 text-sm">عدد الأقساط:</span>
                <span className="font-medium">{contract.numberOfInstallments} شهر</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-400" /> قائمة المنتجات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المنتج</TableHead>
                <TableHead>الشركة</TableHead>
                <TableHead>الكمية</TableHead>
                <TableHead className="text-left">سعر الوحدة</TableHead>
                <TableHead className="text-left">الإجمالي</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contractItems.map((item, idx) => {
                const p = products.find((prod: any) => prod.id === item.productId);
                return (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{p?.name}</TableCell>
                    <TableCell>{p?.manufacturer || 'غير محدد'}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell className="text-left">{FinanceService.formatCurrency(item.productPrice)}</TableCell>
                    <TableCell className="text-left font-bold">{FinanceService.formatCurrency(item.productPrice * item.quantity)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isCash ? (
        <Card className="bg-emerald-600/10 border-emerald-500/20 shadow-lg">
          <CardContent className="py-12 text-center space-y-4">
            <div className="bg-emerald-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
               <Banknote className="h-10 w-10 text-emerald-400" />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="text-2xl font-bold text-emerald-100 font-heading">تم السداد نقداً بالكامل</h3>
              <p className="text-slate-400 mt-2">هذه العملية مسجلة كمبيعات نقدية (كاش) مكتملة ومسددة بالكامل بتاريخ {contract.startDate}</p>
            </div>
            <div className="pt-6 print:hidden">
               <Button className="gap-2 bg-emerald-600 hover:bg-emerald-500 px-8 py-6 text-lg" onClick={() => window.print()}>
                  <Printer className="h-5 w-5" /> طباعة فاتورة البيع
               </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-400" /> جدول الأقساط
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم القسط</TableHead>
                  <TableHead>تاريخ الاستحقاق</TableHead>
                  <TableHead>قيمة القسط</TableHead>
                  <TableHead>المبلغ المدفوع</TableHead>
                  <TableHead>المتبقي</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contractInstallments.map((inst: any) => (
                  <TableRow key={inst.id}>
                    <TableCell className="font-medium">{inst.number}</TableCell>
                    <TableCell>{inst.dueDate}</TableCell>
                    <TableCell>{FinanceService.formatCurrency(inst.amount)}</TableCell>
                    <TableCell>{FinanceService.formatCurrency(inst.paidAmount)}</TableCell>
                    <TableCell>{FinanceService.formatCurrency(inst.remainingAmount)}</TableCell>
                    <TableCell>
                      <Badge variant={inst.status === 'مدفوع' ? 'success' : inst.status === 'متأخر' ? 'destructive' : 'warning'}>
                        {inst.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
