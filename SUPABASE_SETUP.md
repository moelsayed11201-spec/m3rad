# دليل إعداد Supabase للتطبيق (Supabase Setup Guide)

لتشغيل السيرفر وقاعدة البيانات باستخدام **Supabase** بنجاح بدلاً من Firebase وتجنب أي مشاكل حصص استخدام يومية (Quota Limits)، اتبع الخطوات التالية البسيطة:

---

## الخطوة 1: إنشاء مشروع جديد في Supabase

1. اذهب إلى موقع [Supabase](https://supabase.com) وسجل الدخول مجاناً.
2. قم بإنشاء مشروع جديد (**New Project**) وأدخل اسم المشروع وكلمة المرور لقاعدة البيانات.
3. اختر المنطقة الأقرب لك، ثم اضغط على **Create new project**.

---

## الخطوة 2: تهيئة الجداول في قاعدة البيانات (SQL Editor)

بعد اكتمال إنشاء المشروع، قم بالدخول إلى قسم **SQL Editor** من القائمة اليسرى في لوحة تحكم Supabase، ثم اضغط على **New Query** وقم بنسخ ولصق كود SQL التالي بالكامل لتشغيله بنقرة واحدة:

```sql
-- 1. جدول الإعدادات العامة (Settings)
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY,
    value TEXT
);

-- إدراج تهيئة أولية للإعدادات
INSERT INTO public.settings (id, value) VALUES 
('companyName', 'سلسلة كويست للتجارة'),
('vatRate', '15'),
('currency', 'SAR')
ON CONFLICT (id) DO NOTHING;

-- 2. جدول الفروع (Branches)
CREATE TABLE IF NOT EXISTS public.branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TEXT,
    "createdBy" TEXT,
    "updatedAt" TEXT,
    "updatedBy" TEXT
);

-- إدراج فرع تجريبي افتراضي
INSERT INTO public.branches (id, name, address, phone, "isActive", "createdAt", "createdBy") VALUES
('default-branch', 'فرع الإدارة الرئيسي', 'الرياض - الملز', '0500000001', TRUE, NOW()::text, 'system-bootstrap')
ON CONFLICT (id) DO NOTHING;

-- 3. جدول المستخدمين (Users)
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL,
    "isActive" BOOLEAN DEFAULT TRUE,
    "branchIds" TEXT[] DEFAULT '{}',
    "createdAt" TEXT,
    "createdBy" TEXT
);

-- 4. جدول العملاء (Customers)
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY,
    "customerCode" TEXT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    "nationalId" TEXT,
    address TEXT,
    city TEXT,
    employer TEXT,
    salary NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'نشط',
    "branchId" TEXT,
    "createdBy" TEXT,
    "createdAt" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TEXT,
    "isDeleted" BOOLEAN DEFAULT FALSE,
    "deletedAt" TEXT,
    "deletedBy" TEXT,
    "deleteReason" TEXT
);

-- 5. جدول الموردين (Suppliers)
CREATE TABLE IF NOT EXISTS public.suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    "contactName" TEXT,
    phone TEXT,
    email TEXT,
    "taxNumber" TEXT,
    address TEXT,
    notes TEXT,
    "createdAt" TEXT,
    "createdBy" TEXT,
    "isDeleted" BOOLEAN DEFAULT FALSE,
    "deletedAt" TEXT,
    "deletedBy" TEXT,
    "deleteReason" TEXT
);

-- 6. جدول تصنيفات المنتجات (Product Categories)
CREATE TABLE IF NOT EXISTS public.product_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    "branchId" TEXT,
    "createdBy" TEXT,
    "createdAt" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TEXT,
    "isDeleted" BOOLEAN DEFAULT FALSE,
    "deletedAt" TEXT,
    "deletedBy" TEXT,
    "deleteReason" TEXT
);

-- 7. جدول المنتجات (Products)
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    manufacturer TEXT,
    price NUMERIC DEFAULT 0,
    "costPrice" NUMERIC DEFAULT 0,
    "cashPrice" NUMERIC DEFAULT 0,
    "lowStockThreshold" NUMERIC DEFAULT 5,
    supplier TEXT,
    "supplierId" TEXT,
    notes TEXT,
    stock NUMERIC DEFAULT 0,
    barcode TEXT,
    "branchId" TEXT,
    "createdBy" TEXT,
    "createdAt" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TEXT,
    "isDeleted" BOOLEAN DEFAULT FALSE,
    "deletedAt" TEXT,
    "deletedBy" TEXT,
    "deleteReason" TEXT
);

-- 8. جدول العقود (Contracts)
CREATE TABLE IF NOT EXISTS public.contracts (
    id TEXT PRIMARY KEY,
    "customerId" TEXT,
    "branchId" TEXT,
    "totalAmount" NUMERIC DEFAULT 0,
    status TEXT,
    "createdAt" TEXT,
    "createdBy" TEXT,
    "isDeleted" BOOLEAN DEFAULT FALSE,
    "deletedAt" TEXT,
    "deletedBy" TEXT
);

-- 9. جدول الأقساط (Installments)
CREATE TABLE IF NOT EXISTS public.installments (
    id TEXT PRIMARY KEY,
    "contractId" TEXT,
    "branchId" TEXT,
    "dueDate" TEXT,
    status TEXT,
    "amount" NUMERIC DEFAULT 0,
    "createdAt" TEXT,
    "createdBy" TEXT,
    "isDeleted" BOOLEAN DEFAULT FALSE
);

-- 10. جدول الإيصالات والمقبوضات (Receipts)
CREATE TABLE IF NOT EXISTS public.receipts (
    id TEXT PRIMARY KEY,
    amount NUMERIC DEFAULT 0,
    "branchId" TEXT,
    "createdAt" TEXT,
    "createdBy" TEXT,
    "isDeleted" BOOLEAN DEFAULT FALSE
);

-- 11. جدول مستندات حركة المخزن (Inventory Movements)
CREATE TABLE IF NOT EXISTS public.inventoryMovements (
    id TEXT PRIMARY KEY,
    "productId" TEXT,
    quantity NUMERIC DEFAULT 0,
    type TEXT,
    "branchId" TEXT,
    "createdBy" TEXT,
    "createdAt" TEXT,
    "isDeleted" BOOLEAN DEFAULT FALSE
);

-- 12. جدول المصروفات (Expenses)
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY,
    name TEXT,
    category TEXT,
    amount NUMERIC DEFAULT 0,
    date TEXT,
    "paymentMethod" TEXT,
    notes TEXT,
    "branchId" TEXT,
    "createdBy" TEXT,
    "createdAt" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TEXT,
    "isDeleted" BOOLEAN DEFAULT FALSE
);

-- 13. جدول الإيرادات الأخرى (Revenues)
CREATE TABLE IF NOT EXISTS public.revenues (
    id TEXT PRIMARY KEY,
    name TEXT,
    category TEXT,
    amount NUMERIC DEFAULT 0,
    date TEXT,
    "paymentMethod" TEXT,
    notes TEXT,
    "branchId" TEXT,
    "createdBy" TEXT,
    "createdAt" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TEXT,
    "referenceId" TEXT,
    "isDeleted" BOOLEAN DEFAULT FALSE
);

-- 14. سجل التدقيق والعمليات (Audit Logs)
CREATE TABLE IF NOT EXISTS public.auditLogs (
    id TEXT PRIMARY KEY,
    "userId" TEXT,
    action TEXT,
    "createdAt" TEXT,
    "collectionName" TEXT,
    "documentId" TEXT,
    "actorRole" TEXT,
    "actorId" TEXT
);

-- 15. طلبات التعديل والتصحيح (Correction Requests)
CREATE TABLE IF NOT EXISTS public.correctionRequests (
    id TEXT PRIMARY KEY,
    "contractId" TEXT,
    status TEXT,
    "branchId" TEXT,
    reason TEXT,
    "proposedChanges" JSONB,
    "requestedBy" TEXT,
    "requestedAt" TEXT
);
```

اضغط على **Run** بعد كتابة الكود لتهيئة جميع الجداول بالصلاحيات المناسبة.

---

## الخطوة 3: تفعيل الربط في التطبيق (Environment Variables)

الآن، قم بالحصول على بيانات الربط من مشروعك في Supabase بالذهاب لـ:
**Settings > API**

وقم بإعداد المتغيرات التالية في قسم **Secrets** في Google AI Studio:

```env
VITE_SUPABASE_URL=رابط_مشروعك_الخاص_بـ_Supabase
VITE_SUPABASE_ANON_KEY=مفتاح_المشروع_العام_الخاص_بـ_Supabase
```

---

## 💡 وضع التشغيل الاحتياطي التلقائي (Offline-First Resiliency)

* إذا لم تقم بإدخال مفاتيح Supabase بعد، أو إذا كان خادم Supabase غير متاح، **فلن يتوقف البرنامـج أو يتعطل**!
* سيقوم نظام المزامنة والتشغيل الاحتياطي الذكي المدمج في التطبيق (**Dynamic Fallback**) بحفظ وعرض البيانات كلياً وتلقائياً عبر محاكي قاعدة البيانات والـ `localStorage` بالكامل، وعند إدخال المفاتيح سيتم الربط التلقائي بقاعدة بيانات السحابية في Supabase بسلاسة وبسرعة فائقة.
