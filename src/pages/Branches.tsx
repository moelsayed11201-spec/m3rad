import { useState } from 'react';
import { useStore, Branch } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building, Plus, Pencil, Trash2 } from 'lucide-react';

export function Branches() {
  const { branches, addBranch, updateBranch, deleteBranch } = useStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      name: fd.get('name') as string,
      address: fd.get('address') as string,
      phone: fd.get('phone') as string,
      isActive: fd.get('isActive') === 'true',
    };

    if (editingBranch) {
      updateBranch(editingBranch.id, data);
    } else {
      addBranch({ ...data, id: `branch-${Date.now()}` });
    }
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
          <Building className="h-6 w-6 text-indigo-500" />
          <h2 className="text-2xl font-bold">الفروع</h2>
        </div>
        <Button onClick={() => { setEditingBranch(null); setIsDialogOpen(true); }}>
          <Plus className="me-2 h-4 w-4" />
          إضافة فرع
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {branches.map(branch => (
          <Card key={branch.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-bold">{branch.name}</CardTitle>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => { setEditingBranch(branch); setIsDialogOpen(true); }}><Pencil className="w-4 h-4 text-slate-500" /></Button>
                <Button variant="ghost" size="icon" onClick={() => deleteBranch(branch.id)}><Trash2 className="w-4 h-4 text-rose-500" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">{branch.address || 'لا يوجد عنوان'}</p>
              <p className="text-sm text-slate-500">{branch.phone || 'لا يوجد هاتف'}</p>
              <p className="mt-2 text-xs font-semibold">{branch.isActive ? '✅ نشط' : '❌ غير نشط'}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBranch ? 'تعديل الفرع' : 'إضافة فرع جديد'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>اسم الفرع</Label>
              <Input name="name" defaultValue={editingBranch?.name} required />
            </div>
            <div className="space-y-2">
              <Label>العنوان</Label>
              <Input name="address" defaultValue={editingBranch?.address} />
            </div>
            <div className="space-y-2">
              <Label>الهاتف</Label>
              <Input name="phone" defaultValue={editingBranch?.phone} />
            </div>
            <div className="space-y-2">
              <Label>الحالة</Label>
              <select name="isActive" defaultValue={editingBranch ? (editingBranch.isActive ? 'true' : 'false') : 'true'} className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300">
                <option value="true">نشط</option>
                <option value="false">غير نشط</option>
              </select>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>إلغاء</DialogClose>
              <Button type="submit">حفظ</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
