import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Phone, Briefcase, MapPin, Mail, CreditCard } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function CustomerDetail() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { customers, contracts, installments, receipts } = useStore();
  const [activeTab, setActiveTab] = useState<'contracts' | 'payments'>('contracts');

  const customer = customers.find(c => c.id === customerId);

  if (!customer) {
    return <div className="p-8 text-center text-slate-400">العميل غير موجود</div>;
  }

  const customerContracts = contracts.filter(c => c.customerId === customer.id);
  const customerReceipts = receipts.filter(r => r.customerId === customer.id);

  return (
    <div className="space-y-6">
      <Button variant="ghost" className="gap-2 -mb-4" onClick={() => navigate('/customers')}>
        <ArrowLeft className="h-4 w-4" /> العودة للعملاء
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-xl flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-indigo-400" />
                <span>{customer.name}</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                {customer.customerCode && (
                  <Badge variant="outline" className="font-mono text-xs border-indigo-500/30 text-indigo-300">
                    كود: {customer.customerCode}
                  </Badge>
                )}
                {customer.isPreferredCustomer && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-500/15 text-amber-500 border border-amber-500/25">
                    ★ عميل مميز
                  </span>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm text-slate-400"><Briefcase className="h-4 w-4" /> {customer.employer}</p>
              <p className="flex items-center gap-2 text-sm text-slate-400"><Phone className="h-4 w-4" /> {customer.phone}</p>
              {customer.email && <p className="flex items-center gap-2 text-sm text-slate-400"><Mail className="h-4 w-4" /> {customer.email}</p>}
              <p className="flex items-center gap-2 text-sm text-slate-400"><CreditCard className="h-4 w-4" /> {customer.nationalId}</p>
              <p className="flex items-center gap-2 text-sm text-slate-400"><MapPin className="h-4 w-4" /> {customer.city} - {customer.address}</p>
            </div>
          </CardContent>
        </Card>

        {/* New Summary Section */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">ملخص العقود النشطة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
                <p className="text-xs text-slate-400">عدد العقود</p>
                <p className="text-lg font-bold">{customerContracts.filter(c => c.status === 'نشط').length}</p>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
                <p className="text-xs text-slate-400">إجمالي التمويل</p>
                <p className="text-lg font-bold">
                  {customerContracts
                    .filter(c => c.status === 'نشط')
                    .reduce((sum, c) => sum + c.financedAmount, 0)
                    .toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ج.م'}
                </p>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg col-span-2">
                <p className="text-xs text-slate-400">إجمالي المتبقي</p>
                <p className="text-lg font-bold text-red-400">
                  {installments
                    .filter(i => customerContracts.some(c => c.id === i.contractId && c.status === 'نشط'))
                    .reduce((sum, i) => sum + i.remainingAmount, 0)
                    .toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ج.م'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <div className="flex border-b border-white/5">
            <button 
              className={`px-6 py-4 text-sm font-medium ${activeTab === 'contracts' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
              onClick={() => setActiveTab('contracts')}
            >
              العقود النشطة
            </button>
            <button 
              className={`px-6 py-4 text-sm font-medium ${activeTab === 'payments' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
              onClick={() => setActiveTab('payments')}
            >
              سجل المدفوعات
            </button>
          </div>

          <CardContent className="p-6">
            {activeTab === 'contracts' ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم العقد</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الإجمالي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerContracts.map(c => (
                    <TableRow key={c.id}>
                      <TableCell>{c.contractNumber}</TableCell>
                      <TableCell><Badge variant={c.status === 'نشط' ? 'success' : 'secondary'}>{c.status}</Badge></TableCell>
                      <TableCell>{c.totalContractAmount.toLocaleString('en-US')} ج.م</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>طريقة الدفع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerReceipts.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.amount.toLocaleString('en-US')} ج.م</TableCell>
                      <TableCell>{r.method}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
