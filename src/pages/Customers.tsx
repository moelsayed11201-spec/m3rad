import { useState, useMemo } from 'react';
import { useStore, Customer } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Search, Eye, Edit, Trash2, X, AlertCircle, MapPin, FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { FinanceService } from '@/lib/finance';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

export function Customers() {
  const { customers, addCustomer, updateCustomer, deleteCustomer, currentUser } = useStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [companySearch, setCompanySearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    nationalId: '',
    address: '',
    city: '',
    employer: '',
    salary: 0,
    status: 'نشط' as Customer['status']
  });

  const cities = useMemo(() => Array.from(new Set(customers.map(c => c.city).filter(Boolean))), [customers]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(search.toLowerCase()) || 
        c.nationalId.includes(search) || 
        c.phone.includes(search);
      
      const matchesCity = cityFilter === 'all' || c.city === cityFilter;
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesCompany = c.employer?.toLowerCase().includes(companySearch.toLowerCase()) ?? true;

      return matchesSearch && matchesCity && matchesStatus && matchesCompany;
    });
  }, [customers, search, cityFilter, statusFilter, companySearch]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!formData.name.trim()) return setError('يرجى إدخال اسم العميل');
    if (!FinanceService.isValidPhone(formData.phone)) return setError('يرجى إدخال رقم جوال صحيح (11 رقم يبدأ بـ 01)');
    if (!FinanceService.isValidNationalId(formData.nationalId)) return setError('يرجى إدخال رقم قومي صحيح (14 رقم)');
    
    const customer: any = {
      id: editingCustomer?.id || `cust-${Date.now()}`,
      ...formData
    };
    
    if (editingCustomer) {
      updateCustomer(customer);
    } else {
      addCustomer(customer);
    }
    
    setIsModalOpen(false);
    resetForm();
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      nationalId: customer.nationalId,
      address: customer.address || '',
      city: customer.city || '',
      employer: customer.employer || '',
      salary: customer.salary || 0,
      status: customer.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذه الخطوة.')) {
      deleteCustomer(id);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      nationalId: '',
      address: '',
      city: '',
      employer: '',
      salary: 0,
      status: 'نشط'
    });
    setEditingCustomer(null);
  };

  const exportToExcel = () => {
    if (currentUser?.role === 'employee') {
      toast.error('عذراً، موظفو المبيعات لا يمكنهم تصدير قوائم العملاء.');
      return;
    }

    const confirmExport = window.confirm('تحذير: قد يحتوي هذا الملف على بيانات شخصية وعملاء حساسة. هل أنت متأكد؟');
    if (!confirmExport) return;

    try {
      const data = filteredCustomers.map(c => ({
          'الاسم': c.name,
          'رقم الهوية': c.nationalId,
          'رقم الجوال': c.phone,
          'البريد الإلكتروني': c.email || 'غير محدد',
          'المدينة': c.city || 'غير محدد',
          'العنوان': c.address || 'غير محدد',
          'جهة العمل': c.employer || 'غير محدد',
          'الراتب الشهري': c.salary,
          'الحالة': c.status
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'العملاء');
      XLSX.writeFile(wb, `تقرير_العملاء_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('تم تصدير قائمة العملاء إلى Excel بنجاح');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('حدث خطأ أثناء تصدير البيانات');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-heading font-bold tracking-tight">إدارة العملاء</h2>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 border-indigo-500/30 text-indigo-400 hover:bg-slate-800" onClick={exportToExcel}>
            <FileSpreadsheet className="h-4 w-4" />
            <span>تصدير Excel</span>
          </Button>
          <Button className="gap-2" onClick={() => setIsModalOpen(true)}>
            <UserPlus className="h-4 w-4" />
            <span>إضافة عميل جديد</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pl-4 pr-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="بحث بالاسم، الجوال، الهوية..." 
                className="pr-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="بحث باسم الشركة..." 
                className="pr-9"
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
              />
            </div>

            <div className="relative">
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="flex h-10 rounded-md bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-[180px]"
              >
                <option value="all">كل المدن</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-10 rounded-md bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-[150px]"
              >
                <option value="all">كل الحالات</option>
                <option value="نشط">نشط</option>
                <option value="موقوف">موقوف</option>
              </select>
            </div>

            {(search || cityFilter !== 'all' || statusFilter !== 'all' || companySearch) && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                  setSearch('');
                  setCityFilter('all');
                  setStatusFilter('all');
                  setCompanySearch('');
                }}
                className="text-slate-500"
                title="إعادة ضبط الفلاتر"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>كود العميل</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>رقم الهوية</TableHead>
                <TableHead>رقم الجوال</TableHead>
                <TableHead>المدينة</TableHead>
                <TableHead>جهة العمل</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="w-[150px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">لا يوجد عملاء مطابقين للبحث</TableCell>
                </TableRow>
              ) : filteredCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-mono text-xs text-indigo-400 font-bold">{customer.customerCode || '-'}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{customer.name}</span>
                      {customer.isPreferredCustomer && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          ★ عميل مميز
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{customer.nationalId}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>
                    {customer.city ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        <MapPin className="h-3 w-3" />
                        {customer.city}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">غير محدد</span>
                    )}
                  </TableCell>
                  <TableCell>{customer.employer}</TableCell>
                  <TableCell>
                    <Badge variant={customer.status === 'نشط' ? 'success' : 'secondary'}>
                      {customer.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/customers/${customer.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {currentUser?.role === 'ceo' && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(customer)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-rose-500 hover:text-rose-600" onClick={() => handleDelete(customer.id)}>
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
        <DialogContent className="sm:max-w-[600px] bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive" className="bg-rose-500/10 border-rose-500/20 text-rose-500">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">الاسم بالكامل</Label>
                <Input id="name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">رقم الجوال</Label>
                <Input id="phone" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input id="email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nationalId">رقم الهوية الوطنية</Label>
                <Input id="nationalId" required value={formData.nationalId} onChange={e => setFormData({...formData, nationalId: e.target.value})} className="" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">المدينة</Label>
                <Input id="city" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="address">العنوان بالتفصيل</Label>
                <Input id="address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employer">جهة العمل</Label>
                <Input id="employer" value={formData.employer} onChange={e => setFormData({...formData, employer: e.target.value})} className="" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salary">الراتب الشهري (ج.م)</Label>
                <Input id="salary" type="number" value={formData.salary} onChange={e => setFormData({...formData, salary: parseFloat(e.target.value) || 0})} className="" />
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>إلغاء</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500">حفظ البيانات</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
