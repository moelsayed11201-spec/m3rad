import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { useStore, User, UserRole } from './store';
import { useEffect, useState, lazy, Suspense } from 'react';
import { toast } from 'sonner';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const getUniqueSuffix = () => {
  try {
    const dbId = (firebaseConfig as any).firestoreDatabaseId || '';
    const parts = dbId.split('-');
    if (parts.length >= 3) {
      return parts[2];
    }
  } catch (_) {}
  return '6e68939a';
};

const isDemoEmail = (email?: string) => {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return lower === 'moelsayed11201@gmail.com' ||
         lower === 'ceo@gmail.com' || lower.startsWith('ceo+') ||
         lower === 'admin@gmail.com' || lower.startsWith('admin+') ||
         lower === 'employee@gmail.com' || lower.startsWith('employee+');
};

const getDemoRoleAndName = (email: string): { role: UserRole; name: string } => {
  const lower = email.trim().toLowerCase();
  if (lower.startsWith('ceo') || lower === 'moelsayed11201@gmail.com') {
    return { role: 'ceo', name: 'المدير العام / CEO' };
  }
  if (lower.startsWith('admin') || lower.startsWith('manager')) {
    return { role: 'manager', name: 'مدير الفرع / Manager' };
  }
  return { role: 'employee', name: 'موظف تجريبي' };
};

const getFallbackUser = (uid: string, email: string): User => {
  const lower = email.trim().toLowerCase();
  const demoInfo = getDemoRoleAndName(lower);
  return {
    id: uid,
    name: demoInfo.name,
    email: email,
    role: demoInfo.role,
    isActive: true,
    branchIds: demoInfo.role === 'ceo' ? [] : ['default-branch']
  };
};

// Lazy load heavy page components to shrink initial bundle and make Login instantly fast
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail').then(module => ({ default: module.CustomerDetail })));
const ContractDetail = lazy(() => import('./pages/ContractDetail').then(module => ({ default: module.ContractDetail })));
const ReportDetail = lazy(() => import('./pages/ReportDetail').then(module => ({ default: module.ReportDetail })));
const Customers = lazy(() => import('./pages/Customers').then(module => ({ default: module.Customers })));
const Contracts = lazy(() => import('./pages/Contracts').then(module => ({ default: module.Contracts })));
const Collections = lazy(() => import('./pages/Collections').then(module => ({ default: module.Collections })));
const Operations = lazy(() => import('./pages/Operations').then(module => ({ default: module.Operations })));
const NewContract = lazy(() => import('./pages/NewContract').then(module => ({ default: module.NewContract })));
const Reports = lazy(() => import('./pages/Reports').then(module => ({ default: module.Reports })));
const Inventory = lazy(() => import('./pages/Inventory').then(module => ({ default: module.Inventory })));
const Suppliers = lazy(() => import('./pages/Suppliers').then(module => ({ default: module.Suppliers })));
const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
const Users = lazy(() => import('./pages/Users').then(module => ({ default: module.Users })));
const Branches = lazy(() => import('./pages/Branches').then(module => ({ default: module.Branches })));
const Expenses = lazy(() => import('./pages/Expenses').then(module => ({ default: module.Expenses })));

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] h-full w-full py-12 font-sans text-slate-500 gap-3">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-2 border-indigo-100 dark:border-indigo-950/40"></div>
        <div className="absolute inset-0 rounded-full border-2 border-indigo-600 dark:border-indigo-400 border-t-transparent animate-spin"></div>
      </div>
      <p className="text-sm">جاري تحميل الصفحة...</p>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, login, logout } = useStore();
  const [authReady, setAuthReady] = useState(false);
  
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          let userDocSnap = null;
          let isQuotaExceeded = false;
          try {
            userDocSnap = await getDoc(userDocRef);
          } catch (getDocError: any) {
            const errMsg = String(getDocError).toLowerCase();
            if (errMsg.includes('quota') || errMsg.includes('exhausted')) {
              isQuotaExceeded = true;
            } else {
              throw getDocError;
            }
          }

          const lowerEmail = user.email?.toLowerCase();
          let data: User;

          if (isQuotaExceeded) {
            data = getFallbackUser(user.uid, lowerEmail || '');
          } else {
            // Safe Auto-Provisioning for the designated developer/demo accounts on the very first sign-in
            if (!userDocSnap || !userDocSnap.exists()) {
              if (isDemoEmail(lowerEmail)) {
                const { role, name } = getDemoRoleAndName(lowerEmail || '');
                let branchIds: string[] = [];

                const payload = {
                  id: user.uid,
                  name,
                  email: user.email || lowerEmail || '',
                  role,
                  isActive: true,
                  branchIds,
                  createdAt: new Date().toISOString(),
                  createdBy: 'system-bootstrap'
                };

                await setDoc(userDocRef, payload);
                userDocSnap = await getDoc(userDocRef);
              }
            }

            // Step 4: If user document does not exist, sign out & show error
            if (!userDocSnap || !userDocSnap.exists()) {
              await auth.signOut();
              logout();
              toast.error('هذا الحساب غير مسجل في النظام.');
              setAuthReady(true);
              return;
            }

            data = userDocSnap.data() as User;

            // Step 5: If isActive is false, block access
            if (!data.isActive) {
              await auth.signOut();
              logout();
              toast.error('حسابك غير مفعل بعد. برجاء التواصل مع الإدارة.');
              setAuthReady(true);
              return;
            }

            // Step 6: If role is manager or employee and branchIds is empty, block access
            if (data.role !== 'ceo' && (!data.branchIds || data.branchIds.length === 0)) {
              await auth.signOut();
              logout();
              toast.error('لم يتم تعيين فرع لحسابك بعد.');
              setAuthReady(true);
              return;
            }
          }

          // Step 7: Store current user credentials/role in state only after validation compiles
          login({
            id: user.uid,
            name: data.name,
            email: data.email,
            role: data.role,
            isActive: data.isActive,
            branchIds: data.branchIds || []
          });

        } catch (e: any) {
          console.error("Error validation in ProtectedRoute", e);
          await auth.signOut();
          logout();
        }
      } else {
        if (currentUser) logout();
      }
      setAuthReady(true);
    });
    return unsub;
  }, [currentUser, login, logout]);

  if (!authReady) {
    return <div className="flex items-center justify-center min-h-screen font-sans">جاري التحميل...</div>;
  }

  if (!currentUser) return <Navigate to="/login" replace />;

  if (!currentUser.isActive) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center bg-slate-50 dark:bg-slate-900 font-sans">
         <div className="rounded-full bg-amber-500/10 p-6">
           <svg className="w-12 h-12 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
         </div>
         <h2 className="text-2xl font-bold">الحساب قيد المراجعة</h2>
         <p className="text-slate-500 max-w-md">تم إنشاء حسابك بنجاح. يرجى الانتظار حتى يقوم المدير العام بتفعيل الحساب للمتابعة.</p>
         <button onClick={() => logout()} className="mt-4 px-4 py-2 bg-slate-200 dark:bg-slate-800 rounded-md hover:bg-slate-300 dark:hover:bg-slate-700 transition">تسجيل الخروج</button>
      </div>
    );
  }

  if (currentUser.role !== 'ceo' && (!currentUser.branchIds || currentUser.branchIds.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center bg-slate-50 dark:bg-slate-900 font-sans">
         <div className="rounded-full bg-indigo-500/10 p-6">
           <svg className="w-12 h-12 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
         </div>
         <h2 className="text-2xl font-bold">لم يتم تعيين فرع</h2>
         <p className="text-slate-500 max-w-md">حسابك نشط ولكن لم يتم تعيينك لأي فرع بعد. يرجى مراجعة المدير العام لتعيين فرع لك.</p>
         <button onClick={() => logout()} className="mt-4 px-4 py-2 bg-slate-200 dark:bg-slate-800 rounded-md hover:bg-slate-300 dark:hover:bg-slate-700 transition">تسجيل الخروج</button>
      </div>
    );
  }

  return <>{children}</>;
}

function RoleProtectedRoute({ children, allowedRoles = [] }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { currentUser } = useStore();
  
  if (allowedRoles.length > 0 && (!currentUser || !allowedRoles.includes(currentUser.role))) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center animate-in fade-in zoom-in duration-500">
         <div className="rounded-full bg-rose-500/10 p-4">
           <svg className="w-10 h-10 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
         </div>
         <h2 className="text-xl font-bold">غير مصرح لك بالوصول</h2>
         <p className="text-slate-500">هذه الصفحة غير متاحة لصلاحياتك.</p>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  useEffect(() => {
    // Validate connection to Firestore as per security guidelines
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration or internet connection.");
        }
      }
    };
    testConnection();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:customerId" element={<CustomerDetail />} />
          <Route path="contracts" element={<Contracts />} />
          <Route path="contracts/:contractId" element={<ContractDetail />} />
          <Route path="contracts/new" element={<NewContract />} />
          <Route path="collections" element={<Collections />} />
          <Route path="operations" element={<Operations />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="reports" element={<RoleProtectedRoute allowedRoles={['ceo', 'manager']}><Reports /></RoleProtectedRoute>} />
          <Route path="reports/:reportId" element={<RoleProtectedRoute allowedRoles={['ceo', 'manager']}><ReportDetail /></RoleProtectedRoute>} />
          <Route path="expenses" element={<RoleProtectedRoute allowedRoles={['ceo', 'manager']}><Expenses /></RoleProtectedRoute>} />
          <Route path="settings" element={<RoleProtectedRoute allowedRoles={['ceo']}><Settings /></RoleProtectedRoute>} />
          <Route path="users" element={<RoleProtectedRoute allowedRoles={['ceo', 'manager']}><Users /></RoleProtectedRoute>} />
          <Route path="branches" element={<RoleProtectedRoute allowedRoles={['ceo']}><Branches /></RoleProtectedRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
