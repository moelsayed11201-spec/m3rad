import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Printer, PieChart, TrendingUp, Users, Package } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';

export function Reports() {
  const navigate = useNavigate();
  const reportsList = [
    { id: 'daily-sales', name: 'المبيعات والتعاقدات', icon: TrendingUp, desc: 'ملخص شامل للمبيعات والعقود' },
    { id: 'collections', name: 'تقرير التحصيلات', icon: PieChart, desc: 'المبالغ المحصلة من الأقساط' },
    { id: 'due', name: 'الأقساط المستحقة', icon: FileText, desc: 'قائمة بالأقساط المستحقة للدفع في الفترة الحالية' },
    { id: 'late', name: 'المتأخرات والتعثر', icon: FileText, desc: 'قائمة بالعملاء المتعثرين والأقساط المتأخرة الدفع' },
    { id: 'inventory-shortage', name: 'تقرير المخزون والنواقص', icon: Package, desc: 'حالة المخزون والمنتجات التي أوشكت على النفاد' },
    { id: 'net-profit', name: 'تقرير صافي الربح', icon: TrendingUp, desc: 'حساب الأرباح' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-heading font-bold tracking-tight">التقارير والإحصائيات</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {reportsList.map((report) => {
          const Icon = report.icon;
          return (
            <Card 
              key={report.id} 
              className="hover:border-indigo-400 transition-colors cursor-pointer group bg-white/5 border-white/10"
              onClick={() => navigate(`/reports/${report.id}`)}
            >
              <CardContent className="p-6">
                <Icon className="h-8 w-8 text-indigo-400 mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="font-bold mb-2 text-slate-100">{report.name}</h3>
                <p className="text-sm text-slate-400 line-clamp-2">{report.desc}</p>
                <div className="mt-4 flex gap-2">
                   <Button variant="outline" size="sm" className="w-full gap-1">عرض التقرير</Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  );
}
