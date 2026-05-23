import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FilePlus, Search, FileText, Filter, X, Trash2, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

import { FinanceService } from '@/lib/finance';

export function Contracts() {
  const navigate = useNavigate();
  const { currentUser, contracts, customers, deleteContract } = useStore();
  const isCEO = currentUser?.role === 'ceo';
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [sortKey, setSortKey] = useState<keyof typeof contracts[0] | 'customerName'>('contractNumber');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Extract unique cities (for the filter dropdown)
  const uniqueCities = Array.from(new Set(customers.map(c => c.city).filter(Boolean)));
  // Extract unique statuses
  const uniqueStatuses = Array.from(new Set(contracts.map(c => c.status)));

  const filteredContracts = contracts.filter(c => {
    const customer = customers.find(cust => cust.id === c.customerId);
    
    // Search match
    const matchesSearch = c.contractNumber.includes(search) || (customer && customer.name.includes(search));
    
    // Status match
    const matchesStatus = filterStatus ? c.status === filterStatus : true;
    
    // City match
    const matchesCity = filterCity ? (customer && customer.city === filterCity) : true;
    
    // Date match
    const matchesDateFrom = filterDateFrom ? new Date(c.startDate) >= new Date(filterDateFrom) : true;
    const matchesDateTo = filterDateTo ? new Date(c.startDate) <= new Date(filterDateTo) : true;

    return matchesSearch && matchesStatus && matchesCity && matchesDateFrom && matchesDateTo;
  }).sort((a, b) => {
    let aVal: any = a[sortKey as keyof typeof a];
    let bVal: any = b[sortKey as keyof typeof b];

    if (sortKey === 'customerName') {
      const cA = customers.find(c => c.id === a.customerId)?.name || '';
      const cB = customers.find(c => c.id === b.customerId)?.name || '';
      aVal = cA;
      bVal = cB;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const clearFilters = () => {
    setFilterStatus('');
    setFilterCity('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const exportToExcel = () => {
    if (currentUser?.role === 'employee') {
      toast.error('عذراً، موظفو المبيعات لا يمكنهم تصدير قوائم العقود.');
      return;
    }

    const confirmExport = window.confirm('قد يحتوي هذا الملف على بيانات مالية وعملاء حساسة جداً. هل أنت متأكد من رغبتك في التصدير؟');
    if (!confirmExport) return;

    try {
      const data = filteredContracts.map(c => {
        const customer = customers.find(cust => cust.id === c.customerId);
        return {
          'رقم العقد': c.contractNumber,
          'العميل': customer?.name || 'غير معروف',
          'رقم الهاتف': customer?.phone || '-',
          'تاريخ البداية': c.startDate,
          'القيمة الإجمالية': c.totalContractAmount,
          'المقدم': c.downPayment,
          'المبلغ الممول': c.financedAmount,
          'النوع': c.contractType,
          'قيمة القسط': c.installmentAmount,
          'المدة (أشهر)': c.numberOfInstallments,
          'الحالة': c.status
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'العقود');
      XLSX.writeFile(wb, `تقرير_العقود_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('تم تصدير قائمة العقود إلى Excel بنجاح');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('حدث خطأ أثناء تصدير البيانات');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-heading font-bold tracking-tight">إدارة العقود</h2>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 border-indigo-500/30 text-indigo-400 hover:bg-slate-800" onClick={exportToExcel}>
            <FileSpreadsheet className="h-4 w-4" />
            <span>تصدير Excel</span>
          </Button>
          <Button className="gap-2" onClick={() => navigate('/contracts/new')}>
            <FilePlus className="h-4 w-4" />
            <span>إنشاء عقد جديد</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pl-4 pr-4 border-b border-white/5 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div className="relative flex-1 max-w-sm w-full">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="بحث برقم العقد أو اسم العميل..." 
                className="pr-9 w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button 
              variant={showFilters ? "secondary" : "outline"} 
              className="gap-2 shrink-0"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
              <span>تصفية متقدمة</span>
            </Button>
          </div>
          
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 mt-2 border-t border-white/5 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">حالة العقد</label>
                <select 
                  className="flex h-10 w-full rounded-md bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="">الكل</option>
                  {uniqueStatuses.map(s => (
                    <option key={String(s)} value={String(s)}>{String(s)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">المدينة</label>
                <select 
                  className="flex h-10 w-full rounded-md bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={filterCity}
                  onChange={(e) => setFilterCity(e.target.value)}
                >
                  <option value="">كل المدن</option>
                  {uniqueCities.map(c => (
                    <option key={String(c)} value={String(c)}>{String(c)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">تاريخ البداية (من)</label>
                <Input 
                  type="date" 
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">تاريخ البداية (إلى)</label>
                <div className="flex gap-2 items-center">
                  <Input 
                    type="date" 
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                  />
                  {(filterStatus || filterCity || filterDateFrom || filterDateTo) && (
                    <Button variant="ghost" size="icon" onClick={clearFilters} className="shrink-0 text-slate-400 hover:text-slate-300">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:text-indigo-400" onClick={() => handleSort('contractNumber')}>رقم العقد {sortKey === 'contractNumber' && (sortDirection === 'asc' ? '↑' : '↓')}</TableHead>
                <TableHead className="cursor-pointer hover:text-indigo-400" onClick={() => handleSort('customerName')}>العميل {sortKey === 'customerName' && (sortDirection === 'asc' ? '↑' : '↓')}</TableHead>
                <TableHead className="cursor-pointer hover:text-indigo-400" onClick={() => handleSort('startDate')}>تاريخ البداية {sortKey === 'startDate' && (sortDirection === 'asc' ? '↑' : '↓')}</TableHead>
                <TableHead className="cursor-pointer hover:text-indigo-400" onClick={() => handleSort('totalContractAmount')}>القيمة الإجمالية {sortKey === 'totalContractAmount' && (sortDirection === 'asc' ? '↑' : '↓')}</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>قيمة القسط</TableHead>
                <TableHead>المدة</TableHead>
                <TableHead className="cursor-pointer hover:text-indigo-400" onClick={() => handleSort('status')}>الحالة {sortKey === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">لا يوجد عقود مطابقة للبحث</TableCell>
                </TableRow>
              ) : filteredContracts.map((contract) => {
                const customer = customers.find(c => c.id === contract.customerId);
                return (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium text-brand-600">{contract.contractNumber}</TableCell>
                    <TableCell>{customer?.name}</TableCell>
                    <TableCell>{contract.startDate}</TableCell>
                    <TableCell className="font-bold">{FinanceService.formatCurrency(contract.totalContractAmount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={contract.contractType === 'نقدي' ? 'border-emerald-500/50 text-emerald-400' : 'border-indigo-500/50 text-indigo-400'}>
                        {contract.contractType === 'نقدي' ? 'كاش' : 'تقسيط'}
                      </Badge>
                    </TableCell>
                    <TableCell>{contract.contractType === 'نقدي' ? '-' : FinanceService.formatCurrency(contract.installmentAmount)}</TableCell>
                    <TableCell>{contract.contractType === 'نقدي' ? 'دفعة واحدة' : `${contract.numberOfInstallments} شهر`}</TableCell>
                    <TableCell>
                      <Badge variant={contract.status === 'نشط' ? 'default' : contract.status === 'مكتمل' ? 'success' : contract.status === 'متأخر' ? 'destructive' : 'secondary'}>
                        {contract.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/contracts/${contract.id}`)}>
                          <FileText className="h-4 w-4 text-slate-500" />
                        </Button>
                        {isCEO && (
                          <Button variant="ghost" size="icon" className="text-rose-500 hover:text-rose-600" onClick={() => {
                            if (confirm('هل أنت متأكد من حذف هذا العقد وجميع أقساطه؟')) {
                              deleteContract(contract.id);
                            }
                          }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
