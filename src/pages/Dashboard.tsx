import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useStore } from '@/store';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Banknote, FileText, AlertCircle, TrendingUp, DollarSign, Package, Coins, Download, Database } from 'lucide-react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { FinanceService } from '@/lib/finance';
import { useMemo } from 'react';

export function Dashboard() {
  const { currentUser, contracts, installments, customers, expenses, products } = useStore() as any;
  const isAdmin = currentUser?.role === 'admin';

  // Memoize all dashboard metrics and chart series calculations for maximum page rendering speed
  const {
    productsWithMissingCost,
    showCostWarning,
    totalSales,
    totalCollected,
    cogs,
    expectedProfit,
    totalOtherIn,
    totalOtherOut,
    totalInventoryPurchases,
    netCashFlow,
    netProfit,
    lowStockProducts,
    lateInstallments,
    lateAmount,
    monthlyData,
  } = useMemo(() => {
    const productsList = products || [];
    const productsWithMissingCost = productsList.filter((p: any) => !p.costPrice || p.costPrice <= 0);
    const showCostWarning = productsWithMissingCost.length > 0;

    // Calculate metrics
    const totalSales = (contracts || []).reduce((acc: number, curr: any) => acc + curr.totalContractAmount, 0);
    const totalCollected = (installments || []).reduce((acc: number, curr: any) => acc + curr.paidAmount, 0);
    
    // COGS (Cost of goods sold) - excluding products with missing cost for accuracy warning
    const cogs = (contracts || []).reduce((acc: number, curr: any) => {
        return acc + FinanceService.calculateContractCost(curr, productsList);
    }, 0);

    const expectedProfit = totalSales - cogs;

    const totalOtherIn = (expenses || []).filter((e: any) => e.type === 'in' && e.category !== 'تحصيل أقساط').reduce((s: number, e: any) => s + e.amount, 0);
    const totalOtherOut = (expenses || []).filter((e: any) => e.type === 'out' && e.category !== 'مشتريات للمخزون').reduce((s: number, e: any) => s + e.amount, 0);
    const totalInventoryPurchases = (expenses || []).filter((e: any) => e.category === 'مشتريات للمخزون').reduce((s: number, e: any) => s + e.amount, 0);

    const netCashFlow = totalCollected + totalOtherIn - totalOtherOut - totalInventoryPurchases;
    const netProfit = expectedProfit + totalOtherIn - totalOtherOut; // Note: Inventory purchases are assets, not period expenses in pure profit terms, but we subtract operational expenses

    const lowStockProducts = productsList.filter((p: any) => p.stock <= (p.lowStockThreshold || 5));

    const lateInstallments = (installments || []).filter((i: any) => i.status === 'متأخر');
    const lateAmount = lateInstallments.reduce((acc: number, curr: any) => acc + curr.remainingAmount, 0);

    // Calculate Dynamic Chart Data
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return {
        name: format(d, 'MMM'),
        month: d.getMonth(),
        year: d.getFullYear(),
        sales: 0,
        collections: 0
      };
    }).reverse();

    (contracts || []).forEach((c: any) => {
      if (!c.startDate) return;
      const d = parseISO(c.startDate);
      const monthIndex = last6Months.findIndex(m => m.month === d.getMonth() && m.year === d.getFullYear());
      if (monthIndex !== -1) {
        last6Months[monthIndex].sales += c.totalContractAmount;
      }
    });

    (installments || []).forEach((i: any) => {
      if (i.paymentDate) {
        const d = parseISO(i.paymentDate);
        const monthIndex = last6Months.findIndex(m => m.month === d.getMonth() && m.year === d.getFullYear());
        if (monthIndex !== -1) {
          last6Months[monthIndex].collections += i.paidAmount;
        }
      }
    });

    const monthlyLabels: Record<string, string> = {
      'Jan': 'يناير', 'Feb': 'فبراير', 'Mar': 'مارس', 'Apr': 'أبريل', 'May': 'مايو', 'Jun': 'يونيو',
      'Jul': 'يوليو', 'Aug': 'أغسطس', 'Sep': 'سبتمبر', 'Oct': 'أكتوبر', 'Nov': 'نوفمبر', 'Dec': 'ديسمبر'
    };

    const monthlyData = last6Months.map(m => ({
      name: monthlyLabels[m.name] || m.name,
      sales: m.sales,
      collections: m.collections
    }));

    return {
      productsWithMissingCost,
      showCostWarning,
      totalSales,
      totalCollected,
      cogs,
      expectedProfit,
      totalOtherIn,
      totalOtherOut,
      totalInventoryPurchases,
      netCashFlow,
      netProfit,
      lowStockProducts,
      lateInstallments,
      lateAmount,
      monthlyData,
    };
  }, [contracts, installments, expenses, products]);

  const navigate = useNavigate();

  const handleExportJSON = () => {
    try {
      if (!window.confirm('تحذير: هذا التصدير سيحتوي على معلومات مالية وبيانات عملاء حساسة. هل أنت متأكد؟')) return;
      
      const storeState = useStore.getState() as any;
      const dataToExport = {
        customers: storeState.customers || [],
        products: storeState.products || [],
        productCategories: storeState.productCategories || [],
        contracts: storeState.contracts || [],
        installments: storeState.installments || [],
        receipts: storeState.receipts || [],
        expenses: storeState.expenses || [],
        inventoryMovements: storeState.inventoryMovements || [],
        suppliers: storeState.suppliers || [],
        settings: storeState.settings || {},
        exportDate: new Date().toISOString(),
        exportedBy: storeState.currentUser?.name || 'unknown'
      };
      
      const backupJson = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([backupJson], { type: 'application/json;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sahabi-erp-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('تم تصدير البيانات بصيغة JSON بنجاح');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تصدير البيانات');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-heading font-bold tracking-tight">نظرة عامة</h2>
        <Button variant="outline" className="gap-2 border-indigo-500/30 text-indigo-400 hover:text-white hover:bg-indigo-600 transition-all font-medium text-xs sm:text-sm" onClick={handleExportJSON}>
          <Download className="h-4 w-4" /> تصدير البيانات بصيغة JSON
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المبيعات الآجلة</CardTitle>
            <Banknote className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{FinanceService.formatCurrency(totalSales)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي التحصيلات</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{FinanceService.formatCurrency(totalCollected)}</div>
          </CardContent>
        </Card>
        {isAdmin && (
          <Card className="bg-slate-800/10 border-slate-700/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي الإيرادات الأخرى</CardTitle>
              <Coins className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{FinanceService.formatCurrency(totalOtherIn)}</div>
            </CardContent>
          </Card>
        )}
        {isAdmin && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">تكلفة البضاعة المباعة</CardTitle>
              <Package className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{FinanceService.formatCurrency(cogs)}</div>
            </CardContent>
          </Card>
        )}
        {isAdmin && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">الربح المتوقع</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">{FinanceService.formatCurrency(expectedProfit)}</div>
            </CardContent>
          </Card>
        )}
        {isAdmin && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي المصروفات</CardTitle>
              <Coins className="h-4 w-4 text-rose-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-400">{FinanceService.formatCurrency(totalOtherOut)}</div>
            </CardContent>
          </Card>
        )}
        {isAdmin && (
          <Card className="bg-emerald-600/10 border-emerald-500/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">صافي الحركة النقدية</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">{FinanceService.formatCurrency(netCashFlow)}</div>
            </CardContent>
          </Card>
        )}
        {isAdmin && (
          <Card className="bg-indigo-600/10 border-indigo-500/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">صافي الربح</CardTitle>
              <TrendingUp className="h-4 w-4 text-indigo-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-400">{FinanceService.formatCurrency(netProfit)}</div>
            </CardContent>
          </Card>
        )}
        <Card className="bg-rose-500/10 border-rose-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-rose-300">المتأخرات</CardTitle>
            <AlertCircle className="h-4 w-4 text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-400">{FinanceService.formatCurrency(lateAmount)}</div>
            <p className="text-xs text-rose-300 mt-1 font-bold italic">{lateInstallments.length} قسط متأخر</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/20 cursor-pointer" onClick={() => navigate('/inventory')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-500">تنبيهات المخزون</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{lowStockProducts.length}</div>
            <p className="text-xs text-amber-600 mt-1 font-bold italic">منتجات تحت الحد الأدنى</p>
          </CardContent>
        </Card>
      </div>

      {showCostWarning && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="text-sm text-amber-600 font-bold">
              يوجد {productsWithMissingCost.length} منتجات بدون سعر تكلفة. لا يمكن حساب الربح وتكلفة البضاعة بدقة حتى يتم تحديث بياناتها.
            </div>
            <Button variant="outline" size="sm" className="mr-auto border-amber-500/30 text-amber-600 hover:bg-amber-500/10" onClick={() => navigate('/inventory')}>تحديث المخزون</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 lg:col-span-7 min-w-0">
          <CardHeader>
            <CardTitle>المبيعات مقابل التحصيلات</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 flex flex-col min-h-0 min-w-0">
            <div className="w-full h-[320px] min-h-[280px] min-w-0" dir="ltr">
              {monthlyData.length > 0 && monthlyData.some(d => d.sales > 0 || d.collections > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCollections" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
                    <Tooltip formatter={(value: number) => FinanceService.formatCurrency(value)} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                    <Area type="monotone" dataKey="sales" name="المبيعات" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSales)" />
                    <Area type="monotone" dataKey="collections" name="التحصيلات" stroke="#10b981" fillOpacity={1} fill="url(#colorCollections)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500">لا توجد بيانات كافية لعرض الرسم البياني</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>أحدث العقود</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العميل</TableHead>
                  <TableHead>القيمة</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(contracts || []).slice(-4).reverse().map((contract: any) => {
                  const customer = customers.find((c: any) => c.id === contract.customerId);
                  return (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{customer?.name}</span>
                          <span className="text-xs text-slate-500">{contract.contractNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell>{FinanceService.formatCurrency(contract.totalContractAmount)}</TableCell>
                      <TableCell>
                        <Badge variant={contract.status === 'نشط' ? 'default' : contract.status === 'متأخر' ? 'destructive' : 'success'}>
                          {contract.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>أقساط مستحقة قريباً</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم العقد</TableHead>
                  <TableHead>العميل</TableHead>
                  <TableHead>تاريخ الاستحقاق</TableHead>
                  <TableHead>القيمة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lateInstallments.slice(0, 4).map((inst: any) => {
                  const contract = contracts.find((c: any) => c.id === inst.contractId);
                  const customer = customers.find((c: any) => c.id === contract?.customerId);
                  return (
                    <TableRow key={inst.id}>
                      <TableCell className="font-medium text-brand-600">{contract?.contractNumber}</TableCell>
                      <TableCell>{customer?.name}</TableCell>
                      <TableCell>
                        <Badge variant={inst.status === 'متأخر' ? 'destructive' : 'warning'}>
                          {inst.dueDate}
                        </Badge>
                      </TableCell>
                      <TableCell>{FinanceService.formatCurrency(inst.amount)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
