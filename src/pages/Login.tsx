import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, UserRole, User } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, doc, getDoc, setDoc, collection, getDocs, limit, query } from '@/lib/supabase';
import firebaseConfig from '../../firebase-applet-config.json';

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

const getUniqueEmail = (email: string) => {
  const suffix = getUniqueSuffix();
  const lower = email.trim().toLowerCase();
  const [local, domain] = lower.split('@');
  return `${local}+${suffix}@${domain}`;
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

export function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, logout } = useStore();
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) {
      toast.error('يرجى ملء جميع الحقول المطلوبة للتسجيل');
      return;
    }

    try {
      setLoading(true);
      
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      const lowerEmail = user.email?.toLowerCase();
      const userDocRef = doc(db, 'users', user.uid);

      let role: UserRole = 'employee';
      let displayName = name.trim();
      let isActiveUser = false;
      let branchIds: string[] = [];

      // Auto-provisioning roles for demo emails
      if (lowerEmail && isDemoEmail(lowerEmail)) {
        isActiveUser = true;
        const demoInfo = getDemoRoleAndName(lowerEmail);
        role = demoInfo.role;
        displayName = demoInfo.name;
      }

      // If we need a default branch for demonstration purposes, try to query or use a fallback
      if (role !== 'ceo') {
        try {
          const branchesSnap = await getDocs(query(collection(db, 'branches'), limit(1)));
          if (!branchesSnap.empty) {
            branchIds = [branchesSnap.docs[0].id];
          } else {
            branchIds = ['default-branch'];
          }
        } catch (_) {
          branchIds = ['default-branch'];
        }
      }

      const payload = {
        id: user.uid,
        name: displayName,
        email: user.email || lowerEmail,
        role,
        isActive: isActiveUser,
        branchIds,
        createdAt: new Date().toISOString(),
        createdBy: 'system-bootstrap-register'
      };

      await setDoc(userDocRef, payload);

      login({
        id: user.uid,
        name: displayName,
        email: user.email || lowerEmail,
        role,
        isActive: isActiveUser,
        branchIds
      });

      toast.success('تم إنشاء الحساب الجديد ومزامنة صلاحياته بنجاح!');

      if (!isActiveUser) {
        await signOut(auth);
        logout();
        toast.error('تم تسجيل حسابك كـ موظف جديد بانتظار التفعيل. يرجى الدخول بحساب المدير العام (CEO) لتفعيل هذا الحساب.');
        setMode('login');
      } else {
        navigate('/');
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      let errorMsg = 'حدث خطأ أثناء إنشاء الحساب.';
      if (error.code === 'auth/email-already-in-use') {
        errorMsg = 'هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول.';
      } else if (error.code === 'auth/weak-password') {
        errorMsg = 'كلمة المرور ضعيفة جداً. يجب أن تكون 6 أحرف أو أرقام على الأقل.';
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = 'صيغة البريد الإلكتروني غير صحيحة.';
      }
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    const trimmedEmail = email.trim();
    const lowerEmail = trimmedEmail.toLowerCase();

    try {
      setLoading(true);
      
      let userCredential;
      try {
        // First try to sign in
        userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      } catch (signInError: any) {
        // If sign in fails because the account is not created yet, and it's a demo email,
        // we can automatically register/create it to boot up the environment smoothly!
        if (
          (signInError.code === 'auth/user-not-found' || 
           signInError.code === 'auth/invalid-credential' || 
           signInError.code === 'auth/wrong-password') && 
          isDemoEmail(lowerEmail)
        ) {
          try {
            // Attempt auto-registration
            userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
            toast.info('تم تجهيز وتهيئة الحساب التجريبي تلقائياً في نظام Firebase.');
          } catch (regError) {
            // If registration fails (e.g., password is too weak or email already in use due to real bad credentials), rethrow the original sign-in error
            throw signInError;
          }
        } else {
          throw signInError;
        }
      }

      const user = userCredential.user;

      // Fetch users/{uid}
      const userDocRef = doc(db, 'users', user.uid);
      let userDocSnap = null;
      let isQuotaExceeded = false;
      try {
        userDocSnap = await getDoc(userDocRef);
      } catch (getDocError: any) {
        const errMsg = String(getDocError).toLowerCase();
        if (errMsg.includes('quota') || errMsg.includes('exhausted')) {
          isQuotaExceeded = true;
          toast.warning('تنبيه: تم تجاوز حد الاستخدام اليومي لـ Firestore. تم تفعيل الدخول بالوضع الاحتياطي مؤقتاً.');
        } else {
          throw getDocError;
        }
      }

      let data: User;

      if (isQuotaExceeded) {
        data = getFallbackUser(user.uid, lowerEmail);
      } else {
        // Safe Auto-Provisioning for the designated developer/demo accounts on the very first sign-in
        if (!userDocSnap || !userDocSnap.exists()) {
          if (isDemoEmail(lowerEmail)) {
            const demoInfo = getDemoRoleAndName(lowerEmail);
            const role = demoInfo.role;
            const displayName = demoInfo.name;
            let branchIds: string[] = [];

            // Fetch first branch
            try {
              const branchesSnap = await getDocs(query(collection(db, 'branches'), limit(1)));
              if (!branchesSnap.empty) {
                branchIds = [branchesSnap.docs[0].id];
              } else {
                branchIds = ['default-branch'];
              }
            } catch (_) {
              branchIds = ['default-branch'];
            }

            const payload = {
              id: user.uid,
              name: displayName,
              email: user.email || lowerEmail,
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

        // If user document does not exist, sign out & show error
        if (!userDocSnap || !userDocSnap.exists()) {
          await signOut(auth);
          logout();
          toast.error('هذا الحساب غير مسجل في النظام.');
          return;
        }

        data = userDocSnap.data() as User;

        // If isActive is false, block access unless it is a demo email
        if (!data.isActive) {
          if (isDemoEmail(lowerEmail)) {
            await setDoc(userDocRef, { isActive: true }, { merge: true });
            data.isActive = true;
          } else {
            await signOut(auth);
            logout();
            toast.error('حسابك غير مفعل بعد. برجاء التواصل مع الإدارة.');
            return;
          }
        }

        // If role is manager or employee and branchIds is empty, block access unless it is a demo email
        if (data.role !== 'ceo' && (!data.branchIds || data.branchIds.length === 0)) {
          if (isDemoEmail(lowerEmail)) {
            let branchIds = ['default-branch'];
            try {
              const branchesSnap = await getDocs(query(collection(db, 'branches'), limit(1)));
              if (!branchesSnap.empty) {
                branchIds = [branchesSnap.docs[0].id];
              }
            } catch (_) {}
            await setDoc(userDocRef, { branchIds }, { merge: true });
            data.branchIds = branchIds;
          } else {
            await signOut(auth);
            logout();
            toast.error('لم يتم تعيين فرع لحسابك بعد واختيار صلاحيات العمل.');
            return;
          }
        }
      }

      // Store current user credentials/role in state only after validation compiles
      login({
        id: user.uid,
        name: data.name,
        email: data.email,
        role: data.role,
        isActive: data.isActive,
        branchIds: data.branchIds || []
      });

      toast.success('تم تسجيل الدخول بنجاح');
      navigate('/');
    } catch (error: any) {
      console.error("Login email/password error:", error);
      let errorMsg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMsg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة، أو لم يتم إنشاء الحساب بعد. اختر "إنشاء حساب جديد" بالأسفل للتسجيل مباشرة.';
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = 'صيغة البريد الإلكتروني غير صحيحة.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMsg = 'عفواً، فشل الاتصال بالإنترنت، يرجى التحقق من الشبكة.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMsg = 'تم حظر محاولات الدخول مؤقتاً لكثرة المحاولات الفاشلة، جرب لاحقاً.';
      }
      
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const triggerQuickLogin = async (quickEmail: string, quickPass: string) => {
    try {
      setLoading(true);
      const originalEmail = quickEmail.trim();
      const lowerOriginal = originalEmail.toLowerCase();
      
      let userCredential;
      let usedEmail = originalEmail;

      try {
        // Step A: Attempt standard original email login first
        userCredential = await signInWithEmailAndPassword(auth, originalEmail, quickPass);
      } catch (signInError: any) {
        // If it fails (e.g., due to different password in the shared tenant pool of sandbox),
        // we automatically try or fallback to the workspace-unique sub-addressed email to avoid collisions completely!
        const uniqueEmail = getUniqueEmail(originalEmail);
        try {
          userCredential = await signInWithEmailAndPassword(auth, uniqueEmail, quickPass);
          usedEmail = uniqueEmail;
        } catch (uniqueSignInError) {
          // If the unique account hasn't been created yet, attempt to register it
          try {
            userCredential = await createUserWithEmailAndPassword(auth, uniqueEmail, quickPass);
            usedEmail = uniqueEmail;
            toast.info('تم تهيئة حساب تجريبي آمن ومستقل مخصص لبيئتك الحالية.');
          } catch (regError) {
            // Fallback: If registration fails for unique, try registering the original email
            try {
              userCredential = await createUserWithEmailAndPassword(auth, originalEmail, quickPass);
              usedEmail = originalEmail;
            } catch (_) {
              // If completely stuck, throw the original sign-in error
              throw signInError;
            }
          }
        }
      }

      // Update UI input fields for visual feedback
      setEmail(usedEmail);
      setPassword(quickPass);

      const user = userCredential.user;
      const lowerUsed = usedEmail.toLowerCase();
      const userDocRef = doc(db, 'users', user.uid);
      
      let userDocSnap = null;
      let isQuotaExceeded = false;
      try {
        userDocSnap = await getDoc(userDocRef);
      } catch (getDocError: any) {
        const errMsg = String(getDocError).toLowerCase();
        if (errMsg.includes('quota') || errMsg.includes('exhausted')) {
          isQuotaExceeded = true;
          toast.warning('تنبيه: تم تجاوز حد الاستخدام اليومي لـ Firestore. تم تمكين الدخول السريع الاستثنائي.');
        } else {
          throw getDocError;
        }
      }

      let data: User;

      if (isQuotaExceeded) {
        data = getFallbackUser(user.uid, lowerUsed);
      } else {
        if (!userDocSnap || !userDocSnap.exists()) {
          const demoInfo = getDemoRoleAndName(lowerUsed);
          const role = demoInfo.role;
          const displayName = demoInfo.name;
          let branchIds: string[] = [];
          
          try {
            const branchesSnap = await getDocs(query(collection(db, 'branches'), limit(1)));
            if (!branchesSnap.empty) {
              branchIds = [branchesSnap.docs[0].id];
            } else {
              branchIds = ['default-branch'];
            }
          } catch (_) {
            branchIds = ['default-branch'];
          }

          const payload = {
            id: user.uid,
            name: displayName,
            email: user.email || lowerUsed,
            role,
            isActive: true,
            branchIds,
            createdAt: new Date().toISOString(),
            createdBy: 'system-bootstrap'
          };

          await setDoc(userDocRef, payload);
          userDocSnap = await getDoc(userDocRef);
        }

        data = userDocSnap.data() as User;

        if (!data.isActive || (data.role !== 'ceo' && (!data.branchIds || data.branchIds.length === 0))) {
          const updatedBranchIds = (data.branchIds && data.branchIds.length > 0) ? data.branchIds : ['default-branch'];
          const updatedPayload = {
            ...data,
            isActive: true,
            branchIds: updatedBranchIds
          };
          await setDoc(userDocRef, updatedPayload, { merge: true });
          data.isActive = true;
          data.branchIds = updatedBranchIds;
        }
      }

      login({
        id: user.uid,
        name: data.name,
        email: data.email,
        role: data.role,
        isActive: data.isActive,
        branchIds: data.branchIds || []
      });

      toast.success('تم تسجيل الدخول السريع بنجاح');
      navigate('/');
    } catch (error: any) {
      console.error("Quick login error:", error);
      let errorMsg = 'فشل في تسجيل الدخول السريع. جرب كتابة البيانات يدوياً.';
      if (error.code === 'auth/invalid-credential' || error.message?.includes('invalid-credential') || error.message?.includes('INVALID_LOGIN_CREDENTIALS')) {
        errorMsg = 'البريد أو كلمة المرور للمستخدم التجريبي قد تغيّرت في نظام Firebase. يرجى إدخال البيانات يدوياً بالتسجيل أو استخدام خيار "إنشاء حساب جديد" بالأسفل لإنشاء حساب مخصص لك فوراً.';
      } else if (error.code === 'permission-denied' || error.message?.includes('permission')) {
        errorMsg = 'عفواً، تم رفض الوصول بسبب نقص الصلاحيات في Firestore. يرجى المحاولة مرة أخرى.';
      }
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 p-4 relative overflow-hidden">
      <div className="absolute top-[-100px] left-[-100px] w-96 h-96 bg-indigo-600/30 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-100px] right-[200px] w-96 h-96 bg-emerald-600/20 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="z-10 w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-2.5 rounded-xl shadow-lg ring-1 ring-white/10">
              <span className="text-white font-bold text-xl leading-none block">Qe</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">معرض الخطاب</h1>
              <p className="text-xs text-indigo-500 dark:text-indigo-200">إدارة الأقساط والمخازن</p>
            </div>
          </div>
        </div>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/5 shadow-2xl backdrop-blur-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center text-slate-900 dark:text-white">
              {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
            </CardTitle>
            <CardDescription className="text-center text-slate-500 dark:text-slate-400">
              {mode === 'login' 
                ? 'الرجاء إدخال بيانات الاعتماد المعتمدة للدخول للمنظومة' 
                : 'قم بالتسجيل للحصول على حساب وتهيئة صلاحيات عملك'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-right block w-full">البريد الإلكتروني</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="ceo@gmail.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                    className="dir-ltr text-left"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-right block w-full">كلمة المرور</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="******" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    className="dir-ltr text-left"
                  />
                </div>
                <Button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm mt-4 cursor-pointer"
                >
                  {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
                </Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-200 dark:border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-[11px] uppercase">
                    <span className="bg-white dark:bg-slate-900 px-2 text-slate-500 dark:text-slate-400 font-bold">
                      أو الدخول السريع بنقرة واحدة
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="text-[11px] h-9 px-1 border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 cursor-pointer"
                    onClick={() => triggerQuickLogin('ceo@gmail.com', '134567')}
                    disabled={loading}
                  >
                    مدير عام CEO
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-[11px] h-9 px-1 border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 cursor-pointer"
                    onClick={() => triggerQuickLogin('admin@gmail.com', '134567')}
                    disabled={loading}
                  >
                    مدير فرع Admin
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-[11px] h-9 px-1 border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 cursor-pointer"
                    onClick={() => triggerQuickLogin('employee@gmail.com', '134567')}
                    disabled={loading}
                  >
                    موظف مبيعات
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-name" className="text-right block w-full">الاسم بالكامل</Label>
                  <Input 
                    id="reg-name" 
                    type="text" 
                    placeholder="محمد الخطاب" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email" className="text-right block w-full">البريد الإلكتروني</Label>
                  <Input 
                    id="reg-email" 
                    type="email" 
                    placeholder="ceo@gmail.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                    className="dir-ltr text-left"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password" className="text-right block w-full">كلمة المرور</Label>
                  <Input 
                    id="reg-password" 
                    type="password" 
                    placeholder="******" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    className="dir-ltr text-left"
                  />
                </div>
                <Button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm mt-4 cursor-pointer"
                >
                  {loading ? 'جاري إنشاء الحساب...' : 'تسجيل حساب جديد'}
                </Button>
              </form>
            )}

            <div className="mt-4 text-center">
              <button
                type="button"
                className="text-indigo-500 hover:text-indigo-600 text-xs font-semibold underline cursor-pointer"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              >
                {mode === 'login' ? 'ليس لديك حساب؟ سجل حساباً جديداً' : 'لديك حساب بالفعل؟ تسجيل الدخول'}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Setup guide helper box */}
        <div className="mt-6 bg-indigo-500/10 border border-indigo-500/25 rounded-xl p-4 text-xs space-y-2 text-right">
          <p className="font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1 justify-end">
            <span>دليل حسابات التجربة السريعة</span>
            <span>ℹ️</span>
          </p>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            إذا لم تكن قد أنشأت الحسابات في لوحة تحكّم Firebase، يمكنك الضغط على 
            <strong> "ليس لديك حساب؟ سجل حساباً جديداً"</strong> بالأعلى لإنشاء حساب وتجربته فوراً:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 pr-2">
            <li>سجل بريد <strong>ceo@gmail.com</strong> ليتم تعيينك <strong>كمدير عام (CEO)</strong> بصلاحيات كاملة فوراً.</li>
            <li>سجل بريد <strong>admin@gmail.com</strong> ليتم تعيينك <strong>كمدير فرع</strong> بصلاحيات متوسطة.</li>
            <li>سجل بريد <strong>employee@gmail.com</strong> ليتم تعيينك <strong>كموظف بيع</strong> بصلاحيات محدودة.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}


