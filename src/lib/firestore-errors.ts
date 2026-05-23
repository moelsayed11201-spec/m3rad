import { toast } from 'sonner';
import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

let lastShownMessage = '';
let lastShownTime = 0;

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  let userMessage = 'حدث خطأ أثناء الاتصال بقاعدة البيانات، يرجى المحاولة مرة أخرى.';
  const errorMessage = errInfo.error.toLowerCase();
  const isReadOp = operationType === OperationType.LIST || operationType === OperationType.GET;
  
  if (errorMessage.includes('quota exceeded') || errorMessage.includes('resource exhausted') || errorMessage.includes('resource_exhausted')) {
    userMessage = 'تنبيه: تم تجاوز حد القراءة/الكتابة اليومي لـ Firebase (Quota Exceeded). تم تشغيل الوضع الاحتياطي لتصفح بياناتك محلياً مؤقتاً.';
  } else if (errorMessage.includes('permission_denied') || errorMessage.includes('missing or insufficient permissions')) {
    if (isReadOp) {
      userMessage = 'عفواً، ليس لديك الصلاحية لعرض هذه البيانات. يرجى مراجعة المدير العام لموافاة حسابك بالفروع المطلوبة.';
    } else {
      userMessage = 'تم رفض العملية: ليس لديك صلاحية التعديل/الحفظ على هذه البيانات (مرفوض من نظام الأمن).';
    }
  } else if (errorMessage.includes('offline') || errorMessage.includes('failed-precondition')) {
    userMessage = 'يبدو أنك غير متصل بالإنترنت حالياً أو أن خادم Firebase غير مستقر.';
  }

  // Deduplicate rapid toast notifications with the same message within a 3-second window
  const now = Date.now();
  if (userMessage !== lastShownMessage || now - lastShownTime > 3000) {
    toast.error(userMessage, { duration: 5500 });
    lastShownMessage = userMessage;
    lastShownTime = now;
  }
  
  throw new Error(JSON.stringify(errInfo));
}
