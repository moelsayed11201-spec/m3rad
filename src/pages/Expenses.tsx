import { useState, useMemo } from 'react';
import { useStore, Expense } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Coins, HandCoins, ArrowUpRight, ArrowDownRight, Search, Plus, Edit, Trash2, TrendingUp, FileSpreadsheet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, startOfMonth, subMonths, isAfter } from 'date-fns';
import { FinanceService } from '@/lib/finance';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

const OUT_CATEGORIES = [
  'إيجار', 'مرتبات', 'كهرباء', 'مياه', 'إنترنت', 'صيانة', 'نقل وشحن',
  'تسويق وإعلانات', 'ضرائب ورسوم', 'مشتريات للمخزون', 'مصاريف إدارية', 'أخرى'
];

const IN_CATEGORIES = [
  'تحصيل أقساط', 'بيع نقدي', 'إيراد إضافي', 'استرداد', 'أخرى'
];

const PAYMENT_METHODS = ['نقدي', 'تحويل بنكي', 'بطاقة', 'محفظة إلكترونية', 'شيك'];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

export function Expenses() {
  const { currentUser, expenses = [], addExpense, updateExpense, deleteExpense, contracts, products } = useStore();
  const isCEO = currentUser?.role === 'ceo';
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMode, setFilterMode] = useState('all'); // all, collections, inventory
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'نقدي',
    notes: '',
    type: 'out' as 'in' | 'out'
  });

  const filteredExpenses = useMemo(() => {
    return (expenses || []).filter((e: Expense) => {
      const matchSearch = e.name?.includes(search) || (e.notes && e.notes.includes(search));
      const matchType = filterType === 'all' || e.type === filterType;
      const matchCat = filterCategory === 'all' || e.category === filterCategory;
      
      let matchMode = true;
      if (filterMode === 'collections') matchMode = e.category === 'تحصيل أقساط';
      if (filterMode === 'inventory') matchMode = e.category === 'مشتريات للمخزون';
      
      return matchSearch && matchType && matchCat && matchMode;
    }).sort((a: Expense, b: Expense) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, search, filterType, filterCategory, filterMode]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const expense: any = {
      id: editingExpense?.id || `exp-${Date.now()}`,
      ...formData
    };

    if (editingExpense) {
      updateExpense(expense);
    } else {
      addExpense(expense);
    }

    setIsModalOpen(false);
    resetForm();
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      name: expense.name,
      category: expense.category,
      amount: expense.amount,
      date: expense.date,
      paymentMethod: expense.paymentMethod,
      notes: expense.notes,
      type: expense.type
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذه المعاملة؟')) {
      deleteExpense(id);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'نقدي',
      notes: '',
      type: 'out'
    });
    setEditingExpense(null);
  };

  const exportToExcel = () => {
    if (currentUser?.role === 'employee') {
      toast.error('عذراً، موظفو المبيعات لا يمكنهم تصدير تقارير المصروفات.');
      return;
    }

    const confirmExport = window.confirm('قد يحتوي هذا الملف على بيانات مالية حساسة. هل أنت متأكد من رغبتك في التصدير؟');
    if (!confirmExport) return;

    try {
      const data = filteredExpenses.map(e => ({
        'البيان': e.name,
        'النوع': e.type === 'in' ? 'إيراد' : 'مصروف',
        'التصنيف': e.category,
        'المبلغ': e.amount,
        'التاريخ': e.date,
        'طريقة الدفع': e.paymentMethod,
        'ملاحظات': e.notes || '-'
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'المعاملات');
      XLSX.writeFile(wb, `تقرير_المصروفات_والإيرادات_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('تم تصدير قائمة المعاملات إلى Excel بنجاح');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('حدث خطأ أثناء تصدير البيانات');
    }
  };

  // Summaries
  const totalOut = (expenses || []).filter((e: Expense) => e.type === 'out' && e.category !== 'مشتريات للمخزون').reduce((s: number, e: Expense) => s + e.amount, 0);
  const totalInOther = (expenses || []).filter((e: Expense) => e.type === 'in' && e.category !== 'تحصيل أقساط').reduce((s: number, e: Expense) => s + e.amount, 0);
  const totalCollections = (expenses || []).filter((e: Expense) => e.category === 'تحصيل أقساط').reduce((s: number, e: Expense) => s + e.amount, 0);
  const totalInventoryPurchases = (expenses || []).filter((e: Expense) => e.category === 'مشتريات للمخزون').reduce((s: number, e: Expense) => s + e.amount, 0);
  const netCashFlow = totalCollections + totalInOther - totalOut - totalInventoryPurchases;

  // Real profit calculation
  const totalSales = (contracts || []).reduce((acc: number, curr: any) => acc + curr.totalContractAmount, 0);
  const cogs = (contracts || []).reduce((acc: number, curr: any) => {
     return acc + FinanceService.calculateContractCost(curr, products || []);
  }, 0);
  const netProfit = (totalSales - cogs) + totalInOther - totalOut;

  const currentMonthStart = startOfMonth(new Date());
  const currentMonthOut = (expenses || []).filter((e: Expense) => e.type === 'out' && isAfter(new Date(e.date), currentMonthStart)).reduce((s: number, e: Expense) => s + e.amount, 0);

  // Charts Data
  const expensesByCategory = (expenses || []).filter((e: Expense) => e.type === 'out').reduce((acc: any, curr: any) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {} as Record<string, number>);
  const pieData = Object.keys(expensesByCategory).map(key => ({ name: key, value: expensesByCategory[key] }));

  // monthly cache flow last 6 months
  const monthlyData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i));
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      
      const monthLabel = format(monthStart, 'MMM yyyy');
      const inVal = (expenses || []).filter((e: Expense) => e.type === 'in' && new Date(e.date) >= monthStart && new Date(e.date) < monthEnd).reduce((s: number, e: Expense) => s + e.amount, 0);
      const outVal = (expenses || []).filter((e: Expense) => e.type === 'out' && new Date(e.date) >= monthStart && new Date(e.date) < monthEnd).reduce((s: number, e: Expense) => s + e.amount, 0);
      data.push({ name: monthLabel, 'إيرادات': inVal, 'مصروفات': outVal });
    }
    return data;
  }, [expenses]);

  return (
    <div className="space-y-6 flex flex-col min-h-0 h-full max-h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2 text-slate-100">
          <Coins className="h-6 w-6 text-indigo-400" />
          <h2 className="text-2xl font-heading font-bold tracking-tight">إدارة الإيرادات والمصروفات</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 border-indigo-500/30 text-indigo-400 hover:bg-slate-800" onClick={exportToExcel}>
            <FileSpreadsheet className="h-4 w-4" />
            <span>تصدير Excel</span>
          </Button>
          <Button className="gap-2" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4" />
            <span>إضافة معاملة</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 shrink-0">
         <Card className="bg-gradient-to-br from-rose-500/10 to-rose-600/10 border-rose-500/20">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-medium text-rose-500 flex items-center justify-between">
                إجمالي المصروفات التشغيلية
                <ArrowUpRight className="h-4 w-4" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-heading text-slate-100">{FinanceService.formatCurrency(totalOut)}</div>
              <p className="text-xs text-slate-400 mt-1">مصروفات الشهر (الكل): {FinanceService.formatCurrency(currentMonthOut)}</p>
            </CardContent>
         </Card>
         <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border-emerald-500/20">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-medium text-emerald-500 flex items-center justify-between">
                إجمالي تحصيلات الأقساط
                <HandCoins className="h-4 w-4" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-heading text-slate-100">{FinanceService.formatCurrency(totalCollections)}</div>
              <p className="text-xs text-slate-400 mt-1">إيرادات أخرى: {FinanceService.formatCurrency(totalInOther)}</p>
            </CardContent>
         </Card>
         <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 border-indigo-500/20">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-medium text-indigo-400 flex items-center justify-between">
                صافي الحركة النقدية
                <Coins className="h-4 w-4" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-heading text-indigo-400">{FinanceService.formatCurrency(netCashFlow)}</div>
            </CardContent>
         </Card>
         <Card className="bg-amber-500/10 border-amber-500/20">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-medium text-amber-500 flex items-center justify-between">
                مشتريات المخزون
                <Plus className="h-4 w-4" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-heading text-slate-100">{FinanceService.formatCurrency(totalInventoryPurchases)}</div>
            </CardContent>
         </Card>
         <Card className="bg-indigo-600/20 border-indigo-500/30 md:col-span-2">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-medium text-indigo-300 flex items-center justify-between">
                صافي الربح المتوقع
                <TrendingUp className="h-4 w-4" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-heading text-indigo-200">{FinanceService.formatCurrency(netProfit)}</div>
              <p className="text-xs text-slate-400 mt-1">بناءً على العقود النشطة والمصروفات</p>
            </CardContent>
         </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 shrink-0">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">المصروفات والإيرادات (آخر 6 أشهر)</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] w-full flex items-center justify-center">
            {monthlyData.every(d => d.مصروفات === 0 && d.إيرادات === 0) ? (
              <div className="h-full flex items-center justify-center">
                <span className="text-slate-400 text-sm">لا توجد بيانات كافية لعرض الرسم البياني</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                  <RechartsTooltip cursor={{ fill: '#1e293b' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="مصروفات" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="إيرادات" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">المصروفات حسب التصنيف</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] w-full flex items-center justify-center">
            {pieData.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <span className="text-slate-400 text-sm">لا توجد بيانات كافية لعرض الرسم البياني</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc', borderRadius: '8px' }} />
                  <Legend layout="vertical" verticalAlign="middle" align="left" wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="flex-1 flex flex-col min-h-[400px]">
        <div className="p-4 border-b border-slate-200 dark:border-white/5 flex flex-wrap gap-4 shrink-0 items-center justify-between">
           <div className="relative flex-1 min-w-[200px] max-w-sm">
             <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
             <Input placeholder="بحث باسم المعاملة أو الملاحظات..." className="pr-9" value={search} onChange={(e) => setSearch(e.target.value)} />
           </div>
           <div className="flex gap-2 w-full sm:w-auto">
             <select value={filterMode} onChange={e => setFilterMode(e.target.value)} className="flex h-10 rounded-md bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="all">الكل</option>
                <option value="collections">تحصيلات الأقساط</option>
                <option value="inventory">مشتريات المخزون</option>
             </select>
             <select value={filterType} onChange={e => setFilterType(e.target.value)} className="flex h-10 rounded-md bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="all" className="dark:bg-slate-900 text-slate-900 dark:text-slate-100">الكل (إيرادات ومصروفات)</option>
                <option value="out" className="dark:bg-slate-900 text-slate-900 dark:text-slate-100">مصروفات فقط</option>
                <option value="in" className="dark:bg-slate-900 text-slate-900 dark:text-slate-100">إيرادات فقط</option>
             </select>
             <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="flex h-10 rounded-md bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="all" className="dark:bg-slate-900 text-slate-900 dark:text-slate-100">كل التصنيفات</option>
                {[...new Set([...OUT_CATEGORIES, ...IN_CATEGORIES])].map(c => <option key={c} value={c} className="dark:bg-slate-900 text-slate-900 dark:text-slate-100">{c}</option>)}
             </select>
           </div>
        </div>
        <CardContent className="p-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-slate-900 border-b border-white/10 z-10">
              <TableRow>
                <TableHead>البيان</TableHead>
                <TableHead>النوع والتصنيف</TableHead>
                <TableHead>المبلغ (ج.م)</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>طريقة الدفع</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">لا يوجد معاملات مسجلة</TableCell>
                </TableRow>
              ) : filteredExpenses.map((exp: Expense) => (
                <TableRow key={exp.id}>
                  <TableCell className="font-medium text-slate-200">
                    <div className="flex flex-col">
                      <span>{exp.name}</span>
                      {exp.notes && <span className="text-xs text-slate-500 truncate max-w-[200px]">{exp.notes}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                       <Badge variant="outline" className={exp.type === 'in' ? 'border-emerald-500/50 text-emerald-400' : 'border-rose-500/50 text-rose-400'}>
                         {exp.type === 'in' ? <ArrowDownRight className="w-3 h-3 ml-1" /> : <ArrowUpRight className="w-3 h-3 ml-1" />}
                         {exp.type === 'in' ? 'إيراد' : 'مصروف'}
                       </Badge>
                       <span className="text-xs text-slate-400">{exp.category}</span>
                    </div>
                  </TableCell>
                  <TableCell className={`font-bold ${exp.type === 'in' ? 'text-emerald-400' : 'text-slate-100'}`}>
                    {exp.type === 'in' ? '+' : '-'}{FinanceService.formatCurrency(exp.amount)}
                  </TableCell>
                  <TableCell className="text-slate-300">{new Date(exp.date).toLocaleDateString('ar-EG')}</TableCell>
                  <TableCell><Badge variant="secondary" className="bg-slate-800 text-slate-300">{exp.paymentMethod}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isCEO && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(exp)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-rose-500 hover:text-rose-600" onClick={() => handleDelete(exp.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={(open) => { if(!open) resetForm(); setIsModalOpen(open); }}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'تعديل المعاملة' : 'إضافة معاملة جديدة'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2 col-span-2">
                 <Label htmlFor="type">نوع المعاملة</Label>
                 <select id="type" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as 'in'|'out', category: ''})} className="flex h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-transparent dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                   <option value="out" className="dark:bg-slate-900 text-slate-900 dark:text-slate-100">مصروف (خارج)</option>
                   <option value="in" className="dark:bg-slate-900 text-slate-900 dark:text-slate-100">إيراد (داخل)</option>
                 </select>
               </div>
               <div className="space-y-2 col-span-2">
                 <Label htmlFor="e-name">البيان</Label>
                 <Input id="e-name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="amount">المبلغ (ج.م)</Label>
                 <Input id="amount" type="number" required value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value) || 0})} />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="date">التاريخ</Label>
                 <Input id="date" type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="category">التصنيف</Label>
                 <select id="category" required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="flex h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-transparent dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                   <option value="" disabled className="dark:bg-slate-900 text-slate-900 dark:text-slate-100">اختر التصنيف</option>
                   {(formData.type === 'in' ? IN_CATEGORIES : OUT_CATEGORIES).map(cat => <option key={cat} value={cat} className="dark:bg-slate-900 text-slate-900 dark:text-slate-100">{cat}</option>)}
                 </select>
               </div>
               <div className="space-y-2">
                 <Label htmlFor="paymentMethod">طريقة الدفع</Label>
                 <select id="paymentMethod" required value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})} className="flex h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-transparent dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                   {PAYMENT_METHODS.map(cat => <option key={cat} value={cat} className="dark:bg-slate-900 text-slate-900 dark:text-slate-100">{cat}</option>)}
                 </select>
               </div>
               <div className="space-y-2 col-span-2">
                 <Label htmlFor="notes">ملاحظات (اختياري)</Label>
                 <Input id="notes" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
               </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>إلغاء</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500">حفظ المعاملة</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
