import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { FinanceService } from '@/lib/finance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, Printer, FileDown, Table as TableIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { differenceInDays, parseISO } from 'date-fns';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useMemo } from 'react';

export function ReportDetail() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { contracts, customers, installments, expenses, products } = useStore();

  const getReportTitle = () => {
    switch (reportId) {
      case 'daily-sales': return 'المبيعات والتعاقدات';
      case 'collections': return 'تقرير التحصيلات';
      case 'due': return 'الأقساط المستحقة';
      case 'late': return 'تقرير المتأخرات والتعثر';
      case 'inventory-shortage': return 'تقرير المخزون والنواقص';
      case 'net-profit': return 'تقرير صافي الربح';
      default: return 'تقرير غير معروف';
    }
  };

  const tableData = useMemo(() => {
    switch (reportId) {
      case 'daily-sales': {
        // Build maps for O(1) checks inside fast loop
        const customerMap = new Map(customers.map(c => [c.id, c.name]));
        return {
          head: [['رقم العقد', 'العميل', 'حالة العقد', 'سعر القسط', 'الكمية', 'إجمالي البيع', 'المقدم', 'المبلغ الممول', 'إجمالي الربح']],
          body: contracts.map(c => [
            c.contractNumber,
            customerMap.get(c.customerId) || '',
            c.status,
            c.productPrice.toLocaleString('en-US'),
            c.quantity.toString(),
            c.totalContractAmount.toLocaleString('en-US'),
            c.downPayment.toLocaleString('en-US'),
            c.financedAmount.toLocaleString('en-US'),
            c.totalInterest.toLocaleString('en-US')
          ])
        };
      }
      case 'collections':
        return {
          head: [['الرقم', 'التاريخ', 'التصنيف', 'المبلغ', 'طريقة الدفع', 'ملاحظات']],
          body: expenses.filter(e => e.type === 'in' && e.category === 'تحصيل أقساط').map(r => [
            r.id,
            r.date,
            r.category,
            r.amount.toLocaleString('en-US', { maximumFractionDigits: 0 }),
            r.paymentMethod,
            r.notes || ''
          ])
        };
      case 'due': {
        const contractMap = new Map(contracts.map(c => [c.id, c]));
        const customerMap = new Map(customers.map(c => [c.id, c]));
        const now = new Date();
        return {
          head: [['العميل', 'رقم العقد', 'رقم القسط', 'تاريخ الاستحقاق', 'المبلغ المتبقي']],
          body: installments.filter(i => {
            if (i.status !== 'معلق' && i.status !== 'مدفوع جزئياً') return false;
            const diff = differenceInDays(parseISO(i.dueDate), now);
            return diff <= 30 && diff >= 0;
          }).map(i => {
            const contract = contractMap.get(i.contractId);
            const customer = contract ? customerMap.get(contract.customerId) : null;
            return [
              customer?.name || '',
              contract?.contractNumber || '',
              i.number.toString(),
              i.dueDate,
              i.remainingAmount.toLocaleString('en-US')
            ];
          })
        };
      }
      case 'late': {
        const contractMap = new Map(contracts.map(c => [c.id, c]));
        const customerMap = new Map(customers.map(c => [c.id, c]));
        const now = new Date();
        return {
          head: [['العميل', 'رقم العقد', 'رقم القسط', 'تاريخ الاستحقاق', 'أيام التأخير', 'المبلغ المستحق']],
          body: installments.filter(i => i.status === 'متأخر' || (i.status !== 'مدفوع' && differenceInDays(now, parseISO(i.dueDate)) > 0)).map(i => {
            const contract = contractMap.get(i.contractId);
            const customer = contract ? customerMap.get(contract.customerId) : null;
            const lateDays = differenceInDays(now, parseISO(i.dueDate));
            return [
              customer?.name || '',
              contract?.contractNumber || '',
              i.number.toString(),
              i.dueDate,
              lateDays > 0 ? `${lateDays} يوم` : '0 يوم',
              i.remainingAmount.toLocaleString('en-US')
            ];
          })
        };
      }
      case 'net-profit': {
        const totalSales = contracts.reduce((acc, curr) => acc + curr.totalContractAmount, 0);
        const cogsAmount = contracts.reduce((acc, curr) => {
          return acc + FinanceService.calculateContractCost(curr, products);
        }, 0);
        const totalOtherIn = expenses.filter(e => e.type === 'in' && e.category !== 'تحصيل أقساط').reduce((s, e) => s + e.amount, 0);
        const totalOutOperational = expenses.filter(e => e.type === 'out').reduce((s, e) => s + e.amount, 0);
        const nProfit = (totalSales - cogsAmount) + totalOtherIn - totalOutOperational;

        return {
          head: [['البند', 'القيمة']],
          body: [
            ['إجمالي المبيعات بالتقسيط (العقود)', totalSales.toLocaleString('en-US') + ' ج.م'],
            ['تكلفة البضاعة المباعة (COGS)', cogsAmount.toLocaleString('en-US') + ' ج.م'],
            ['إجمالي الإيرادات الأخرى', totalOtherIn.toLocaleString('en-US') + ' ج.م'],
            ['إجمالي المصروفات', totalOutOperational.toLocaleString('en-US') + ' ج.م'],
            ['صافي الربح المتوقع', nProfit.toLocaleString('en-US') + ' ج.م']
          ]
        };
      }
      case 'inventory-shortage':
        return {
          head: [['المنتج', 'التصنيف', 'الباركود', 'البيع تقسيط', 'الكمية بالمخزن', 'الحد الأدنى', 'حالة المخزون']],
          body: products.filter(p => p.stock <= (p.lowStockThreshold || 5)).map(p => [
            p.name,
            p.category,
            p.barcode || '-',
            p.price.toLocaleString('en-US'),
            p.stock.toString(),
            (p.lowStockThreshold || 5).toString(),
            p.stock === 0 ? 'نفد تماماً' : 'نقص بالمخزن'
          ])
        };
      default:
        return { head: [], body: [] };
    }
  }, [reportId, contracts, customers, installments, expenses, products]);

  const handleExportPDF = () => {
    const doc = new jsPDF('p', 'pt', 'a4');
    doc.addFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.setFont('Roboto');
    
    let y = 40;
    doc.text(getReportTitle(), 40, y);
    y += 20;

    // Type definition for autoTable extension doesn't naturally exist on jsPDF standard interface without augmentation
    (doc as any).autoTable({
      head: tableData.head,
      body: tableData.body,
      startY: y,
      theme: 'grid',
      styles: { font: 'Roboto' },
    });
    
    doc.save(`${getReportTitle()}.pdf`);
    toast.success('تم تصدير التقرير PDF بنجاح');
  };

  const handleExportExcel = () => {
    const wsData = [...tableData.head, ...tableData.body];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${getReportTitle()}.xlsx`);
    toast.success('تم تصدير التقرير Excel بنجاح');
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ج.م';
  };

  const renderReportContent = () => {
    if(tableData.body.length === 0) return <div className="text-center py-8 text-slate-500">لا توجد بيانات لهذا التقرير حالياً</div>;

    return (
      <Table>
        <TableHeader>
          <TableRow>
            {tableData.head[0].map((h, i) => <TableHead key={i}>{h}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tableData.body.map((row, rindex) => (
            <TableRow key={rindex}>
              {row.map((cell, cindex) => (
                <TableCell key={cindex}>{cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/reports')}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <h2 className="text-2xl font-heading font-bold tracking-tight">{getReportTitle()}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> طباعة
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportExcel}>
            <TableIcon className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportPDF}>
            <FileDown className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">النتائج</CardTitle>
            <Badge variant="secondary">إجمالي السجلات: {tableData.body.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {renderReportContent()}
        </CardContent>
      </Card>
    </div>
  );
}
