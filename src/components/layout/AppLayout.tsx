import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Suspense } from 'react';

export function AppLayout() {
  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100 font-sans overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute top-[-100px] left-[-100px] w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none print:hidden"></div>
      <div className="absolute bottom-[-100px] right-[200px] w-96 h-96 bg-emerald-600/20 rounded-full blur-[100px] pointer-events-none print:hidden"></div>

      <div className="print:hidden h-full z-20">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col h-full relative z-10 overflow-hidden print:overflow-visible">
        <div className="print:hidden">
          <Header />
        </div>
        <main className="flex-1 overflow-y-auto w-full z-10 print:overflow-visible">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8 py-8 w-full p-8 print:p-0 print:m-0">
            <Suspense fallback={
              <div className="flex flex-col items-center justify-center min-h-[400px] h-full w-full py-12 font-sans text-slate-400 gap-3">
                <div className="relative w-8 h-8 animate-spin rounded-full border-2 border-indigo-600 dark:border-indigo-400 border-t-transparent" />
                <p className="text-sm">جاري تحميل الصفحة...</p>
              </div>
            }>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
