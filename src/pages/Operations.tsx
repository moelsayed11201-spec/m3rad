import { useState } from 'react';
import { useStore } from '@/store';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Search, Activity } from 'lucide-react';

export function Operations() {
  const { receipts, contracts, customers } = useStore() as any;
  const [search, setSearch] = useState('');

  const filteredReceipts = receipts.filter((r: any) => {
    const customer = customers.find((c: any) => c.id === r.customerId);
    const contract = contracts.find((c: any) => c.id === r.contractId);
    return (
      r.id.includes(search) ||
      (customer?.name || '').includes(search) ||
      (contract?.contractNumber || '').includes(search)
    );
  }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-indigo-400" />
          <h2 className="text-2xl font-heading font-bold tracking-tight">سجل العمليات (التحصيلات)</h2>
        </div>
      </div>

      <Card>
        <CardHeader className="pl-4 pr-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="بحث برقم الإيصال، اسم العميل، رقم العقد..." 
                className="pr-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الإيصال</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>رقم العقد</TableHead>
                <TableHead>المبلغ (ج.م)</TableHead>
                <TableHead>طريقة الدفع</TableHead>
                <TableHead>المحصل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReceipts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">لا يوجد عمليات مطابقة</TableCell>
                </TableRow>
              ) : filteredReceipts.map((r: any) => {
                const contract = contracts.find((c: any) => c.id === r.contractId);
                const customer = customers.find((c: any) => c.id === r.customerId);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs text-indigo-400">{r.id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-slate-900 dark:text-slate-200">{new Date(r.date).toLocaleDateString('ar-EG')}</span>
                        <span className="text-xs text-slate-500">{new Date(r.date).toLocaleTimeString('ar-EG')}</span>
                      </div>
                    </TableCell>
                    <TableCell>{customer?.name || 'غير معروف'}</TableCell>
                    <TableCell>{contract?.contractNumber || 'غير معروف'}</TableCell>
                    <TableCell className="font-bold text-emerald-500">
                      {new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(r.amount)}
                    </TableCell>
                    <TableCell>{r.method}</TableCell>
                    <TableCell>{r.collector}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
