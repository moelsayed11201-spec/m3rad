import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Wallet,
  Settings,
  BarChart4,
  Coins,
  Package,
  Activity,
  Truck,
  Building,
  UserCog
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';

export function Sidebar() {
  const location = useLocation();
  const { currentUser } = useStore();

  const navItems = [
    { name: 'الرئيسية', path: '/', icon: LayoutDashboard },
    { name: 'العملاء', path: '/customers', icon: Users },
    { name: 'العقود', path: '/contracts', icon: FileText },
    { name: 'التحصيل', path: '/collections', icon: Wallet },
    { name: 'الموردين', path: '/suppliers', icon: Truck },
    { name: 'العمليات', path: '/operations', icon: Activity },
    { name: 'المخزون', path: '/inventory', icon: Package },
    { name: 'المصروفات', path: '/expenses', icon: Coins, restricted: ['ceo', 'manager'] },
    { name: 'التقارير', path: '/reports', icon: BarChart4, restricted: ['ceo', 'manager'] },
    { name: 'الفروع', path: '/branches', icon: Building, restricted: ['ceo'] },
    { name: 'المستخدمين', path: '/users', icon: UserCog, restricted: ['ceo', 'manager'] },
    { name: 'الإعدادات', path: '/settings', icon: Settings, restricted: ['ceo'] },
  ];

  const visibleNavItems = navItems.filter(item => {
    if (item.restricted && (!currentUser || !item.restricted.includes(currentUser.role))) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex z-10 h-full w-64 flex-col bg-slate-100/80 dark:bg-slate-900/40 backdrop-blur-xl border-l border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100">
      <div className="flex h-16 items-center px-6 border-b border-slate-200 dark:border-white/5 gap-3">
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
        </div>
        <h1 className="text-xl font-heading font-bold tracking-tight">معرض الخطاب</h1>
      </div>
      <nav className="flex-1 space-y-2 p-4 overflow-y-auto w-full">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          
          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "group flex items-center rounded-xl p-3 text-sm transition-colors cursor-pointer",
                isActive 
                  ? "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5"
              )}
            >
              <Icon className={cn("me-3 h-5 w-5 shrink-0", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-300")} />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 dark:border-white/5 p-4">
        <div className="flex items-center gap-3 p-3 bg-slate-200/50 dark:bg-white/5 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center border border-slate-400 dark:border-white/20 text-xs text-slate-900 dark:text-white shadow-sm font-bold">
            {currentUser?.name ? currentUser.name.charAt(0) : 'م'}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold truncate text-slate-900 dark:text-white">{currentUser?.name || 'مستخدم'}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{currentUser?.role === 'ceo' ? 'المدير العام / CEO' : currentUser?.role === 'manager' ? 'مدير فرع / Manager' : 'موظف / Employee'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
