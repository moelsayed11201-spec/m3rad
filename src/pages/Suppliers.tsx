import { useState } from 'react';
import { useStore, Supplier } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Truck, Search, Plus, Edit, Trash2, Phone, Mail, MapPin, Package, User, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

export function Suppliers() {
  const { currentUser, suppliers = [], products = [], addSupplier, updateSupplier, deleteSupplier } = useStore();
  const isCEO = currentUser?.role === 'ceo';
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    categories: [] as string[]
  });

  const filteredSuppliers = suppliers.filter((s: Supplier) => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.phone.includes(search) ||
    s.contactName?.toLowerCase().includes(search.toLowerCase())
  );

  const getSupplierProductsCount = (supplierId: string) => {
    return products.filter((p: any) => p.supplierId === supplierId || p.supplier === suppliers.find((s: Supplier) => s.id === supplierId)?.name).length;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name) return setError('الرجاء إدخال اسم المورد');
    if (!formData.phone) return setError('الرجاء إدخال رقم الهاتف');

    try {
      const supplierData: any = {
        id: editingSupplier?.id || `sup-${Date.now()}`,
        ...formData
      };

      if (editingSupplier) {
        await updateSupplier(supplierData);
        toast.success('تم تحديث بيانات المورد بنجاح');
      } else {
        await addSupplier(supplierData);
        toast.success('تم إضافة المورد بنجاح');
      }

      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء الحفظ');
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contactName: supplier.contactName || '',
      phone: supplier.phone,
      email: supplier.email || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
      categories: supplier.categories || []
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (getSupplierProductsCount(id) > 0) {
      toast.error('لا يمكن حذف المورد لأنه مرتبط بمنتجات في المخزون');
      return;
    }

    if (confirm('هل أنت متأكد من حذف هذا المورد؟')) {
      try {
        await deleteSupplier(id);
        toast.success('تم حذف المورد بنجاح');
      } catch (err: any) {
        toast.error('فشل حذف المورد');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contactName: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
      categories: []
    });
    setEditingSupplier(null);
  };

  return (
    <div className="space-y-6 flex flex-col h-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2 text-slate-100">
          <Truck className="h-6 w-6 text-indigo-400" />
          <h2 className="text-2xl font-heading font-bold tracking-tight">إدارة الموردين</h2>
        </div>
        <Button className="gap-2" onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4" />
          <span>إضافة مورد</span>
        </Button>
      </div>

      <div className="relative flex-1 max-w-sm shrink-0">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input 
          placeholder="بحث عن مورد..." 
          className="pr-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col bg-slate-900/50 border-white/5">
        <CardContent className="p-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-slate-900 border-b border-white/10 z-10">
              <TableRow>
                <TableHead>اسم المورد</TableHead>
                <TableHead>المسؤول</TableHead>
                <TableHead>التواصل</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>المنتجات المرتبطة</TableHead>
                {isCEO && <TableHead className="w-[120px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isCEO ? 6 : 5} className="text-center py-8 text-slate-400">لا يوجد موردين مسجلين</TableCell>
                </TableRow>
              ) : filteredSuppliers.map((s: Supplier) => (
                <TableRow key={s.id} className="hover:bg-white/5 transition-colors group">
                  <TableCell>
                    <div className="font-bold text-slate-100">{s.name}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-slate-300">
                      <User className="h-4 w-4 text-slate-500" />
                      <span>{s.contactName || 'غير محدد'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Phone className="h-3 w-3 text-emerald-400" />
                        <span>{s.phone}</span>
                      </div>
                      {s.email && (
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Mail className="h-3 w-3 text-indigo-400" />
                          <span>{s.email}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <MapPin className="h-3 w-3" />
                      <span>{s.address || 'غير محدد'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-indigo-500/30 text-indigo-300 gap-1.5">
                      <Package className="h-3 w-3" />
                      <span>{getSupplierProductsCount(s.id)} منتجات</span>
                    </Badge>
                  </TableCell>
                  {isCEO && (
                    <TableCell>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-rose-500 hover:text-rose-600" onClick={() => handleDelete(s.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={(open) => { if(!open) resetForm(); setIsModalOpen(open); }}>
        <DialogContent className="sm:max-w-[500px] bg-slate-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-indigo-400" />
              {editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive" className="bg-rose-500/10 border-rose-500/20 text-rose-500">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="s-name">اسم المورد / الشركة</Label>
                <Input id="s-name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-slate-800 border-white/10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactName">اسم المفوض / المسؤول</Label>
                <Input id="contactName" value={formData.contactName} onChange={e => setFormData({...formData, contactName: e.target.value})} className="bg-slate-800 border-white/10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">رقم الهاتف</Label>
                <Input id="phone" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="bg-slate-800 border-white/10" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input id="email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="bg-slate-800 border-white/10" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="address">العنوان</Label>
                <Input id="address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="bg-slate-800 border-white/10" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <Input id="notes" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="bg-slate-800 border-white/10" />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>إلغاء</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500">
                {editingSupplier ? 'تحديث البيانات' : 'حفظ المورد'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
