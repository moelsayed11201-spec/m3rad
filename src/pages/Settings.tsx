import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon, Store, Bell, UserCircle, Database, Percent } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useStore } from '@/store';
import { db, collection, getDocs } from '@/lib/supabase';

export function Settings() {
  const { settings: globalSettings, updateSettings } = useStore() as any;
  const [localSettings, setLocalSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    setLocalSettings(globalSettings || {});
  }, [globalSettings]);

  const saveOrgData = async () => {
     try {
       await updateSettings({
         orgName: localSettings.orgName || 'سحابـي ERP',
         orgTaxId: localSettings.orgTaxId || '300012345678903',
         orgPhone: localSettings.orgPhone || '0500000000',
         orgEmail: localSettings.orgEmail || 'info@sahabi.com'
       });
       toast.success('تم حفظ بيانات المؤسسة');
     } catch (e) {
       toast.error('فشل حفظ البيانات');
     }
  };

  const saveProfitRates = async () => {
    try {
      await updateSettings({
        profitRate6: localSettings.profitRate6 || '15',
        profitRate12: localSettings.profitRate12 || '25',
        profitRate18: localSettings.profitRate18 || '35',
        profitRate24: localSettings.profitRate24 || '45'
      });
      toast.success('تم حفظ نسب الربح');
    } catch (e) {
      toast.error('فشل حفظ نسب الربح');
    }
  };

  const exportData = async () => {
    const { currentUser } = useStore.getState();
    if (currentUser?.role !== 'ceo') {
      toast.error('عذراً، فقط المدير العام يمكنه تصدير النسخة الاحتياطية الكاملة.');
      return;
    }

    const confirmExport = window.confirm('قد يحتوي هذا الملف على بيانات مالية وبيانات عملاء حساسة. هل أنت متأكد من رغبتك في التصدير؟');
    if (!confirmExport) return;

    try {
      const tables = ['customers', 'products', 'contracts', 'installments', 'receipts', 'inventoryMovements', 'expenses', 'product_categories', 'users', 'settings', 'branches', 'revenues', 'auditLogs', 'correctionRequests'];
      const data: Record<string, any[]> = {};
      
      for (const table of tables) {
        const snap = await getDocs(collection(db, table));
        data[table] = snap.docs.map(d => d.data());
      }
      
      const backupJson = JSON.stringify(data, null, 2);
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qeist-backup.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("تم التصدير بنجاح");
    } catch(err) {
      toast.error("حدث خطأ أثناء التصدير");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
        <SettingsIcon className="h-6 w-6 text-indigo-500" />
        <h2 className="text-2xl font-heading font-bold tracking-tight">إعدادات النظام</h2>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Store className="h-5 w-5 text-indigo-500" />
              بيانات المؤسسة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">اسم المؤسسة</label>
                <Input 
                  value={localSettings.orgName ?? 'سحابـي ERP'} 
                  onChange={(e) => setLocalSettings({ ...localSettings, orgName: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">الرقم الضريبي</label>
                <Input 
                  value={localSettings.orgTaxId ?? '300012345678903'} 
                  onChange={(e) => setLocalSettings({ ...localSettings, orgTaxId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">رقم الهاتف</label>
                <Input 
                  value={localSettings.orgPhone ?? '0500000000'}
                  onChange={(e) => setLocalSettings({ ...localSettings, orgPhone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">البريد الإلكتروني</label>
                <Input 
                  value={localSettings.orgEmail ?? 'info@sahabi.com'} 
                  onChange={(e) => setLocalSettings({ ...localSettings, orgEmail: e.target.value })}
                />
              </div>
            </div>
            <div className="pt-2">
              <Button onClick={saveOrgData}>حفظ البيانات</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Percent className="h-5 w-5 text-indigo-500" />
              نسب ربح التقسيط (تلقائية)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-500 mb-4">
              حدد نسبة الربح المئوية التي تضاف على السعر الأساسي للمنتج بناءً على مدة التقسيط.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">6 شهور (%)</label>
                <Input 
                  type="number"
                  value={localSettings.profitRate6 ?? '15'} 
                  onChange={(e) => setLocalSettings({ ...localSettings, profitRate6: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">12 شهر (%)</label>
                <Input 
                  type="number"
                  value={localSettings.profitRate12 ?? '25'} 
                  onChange={(e) => setLocalSettings({ ...localSettings, profitRate12: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">18 شهر (%)</label>
                <Input 
                  type="number"
                  value={localSettings.profitRate18 ?? '35'}
                  onChange={(e) => setLocalSettings({ ...localSettings, profitRate18: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">24 شهر (%)</label>
                <Input 
                  type="number"
                  value={localSettings.profitRate24 ?? '45'} 
                  onChange={(e) => setLocalSettings({ ...localSettings, profitRate24: e.target.value })}
                />
              </div>
            </div>
            <div className="pt-2">
              <Button onClick={saveProfitRates}>حفظ نسب الربح</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5 text-indigo-500" />
              تصدير البيانات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-4">
              يمكنك تصدير نسخة من جميع بياناتك لاستخدامها خارج النظام.
            </p>
            <Button variant="outline" onClick={exportData}>تصدير البيانات بصيغة JSON</Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
