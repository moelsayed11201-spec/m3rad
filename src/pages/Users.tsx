import { useState } from 'react';
import { useStore, User, UserRole } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserCog, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function Users() {
  const { users, branches, updateUser, currentUser } = useStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const displayUsers = currentUser?.role === 'ceo' ? users : users.filter(u => u.branchIds?.some(id => currentUser?.branchIds?.includes(id)));

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const selectedBranches = Array.from(fd.getAll('branchIds')) as string[];
    const data = {
      role: fd.get('role') as UserRole,
      isActive: fd.get('isActive') === 'true',
      branchIds: selectedBranches,
    };

    if (editingUser) {
      updateUser(editingUser.id, data);
      setIsDialogOpen(false);
      toast.success('تم التحديث بنجاح');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
          <UserCog className="h-6 w-6 text-indigo-500" />
          <h2 className="text-2xl font-bold">المستخدمين</h2>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {displayUsers.map(user => (
          <Card key={user.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-bold">{user.name}</CardTitle>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => { setEditingUser(user); setIsDialogOpen(true); }}><Pencil className="w-4 h-4 text-slate-500" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">{user.email}</p>
              <p className="text-sm text-slate-500">
                {user.role === 'ceo' ? 'المدير العام / CEO' : user.role === 'manager' ? 'مدير فرع / Manager' : 'موظف / Employee'}
              </p>
              {user.branchIds && user.branchIds.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-semibold text-indigo-500">الفروع المعينة:</p>
                  <div className="flex flex-wrap gap-1">
                    {user.branchIds.map(bid => (
                      <span key={bid} className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-500 rounded text-[10px]">
                        {branches.find(b => b.id === bid)?.name || 'غير معروف'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="mt-2 text-xs font-semibold">{user.isActive ? '✅ نشط' : '❌ قيد المراجعة'}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل صلاحيات المستخدم</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>الاسم</Label>
                <Input value={editingUser.name} disabled />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input value={editingUser.email} disabled />
              </div>
              
              <div className="space-y-2">
                <Label>الدور / الصلاحية</Label>
                <select 
                  name="role" 
                  defaultValue={editingUser.role} 
                  disabled={currentUser?.role !== 'ceo'}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300"
                >
                  <option value="employee">موظف / Employee</option>
                  <option value="manager">مدير / Manager</option>
                  <option value="ceo">المدير العام / CEO</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <Label>تعيين الفروع</Label>
                <div className="grid grid-cols-2 gap-2 p-3 border rounded-md dark:border-white/10 max-h-40 overflow-y-auto bg-slate-50 dark:bg-slate-900">
                  {branches.map(b => (
                    <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 p-1 rounded">
                      <input 
                        type="checkbox" 
                        name="branchIds" 
                        value={b.id} 
                        defaultChecked={editingUser.branchIds?.includes(b.id)}
                        disabled={currentUser?.role !== 'ceo' && editingUser.role === 'ceo'}
                        className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{b.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>الحالة</Label>
                <select 
                  name="isActive" 
                  defaultValue={editingUser.isActive ? 'true' : 'false'} 
                  disabled={currentUser?.role !== 'ceo'}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300"
                >
                  <option value="true">نشط</option>
                  <option value="false">قيد المراجعة / موقوف</option>
                </select>
              </div>

              <DialogFooter>
                <DialogClose render={<Button variant="outline" type="button" />}>إلغاء</DialogClose>
                {(currentUser?.role === 'ceo' || (currentUser?.role === 'manager' && editingUser.role === 'employee')) && (
                   <Button type="submit">حفظ التغييرات</Button>
                )}
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
