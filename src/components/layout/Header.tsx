import { Bell, Search, Sun, Moon, CheckCircle2, AlertCircle, Info, UserCircle2, LogOut } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useStore, Notification } from '@/store';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

export function Header() {
  const navigate = useNavigate();
  const { theme, setTheme, currentUser, logout, notifications: storeNotifications, markNotificationAsRead } = useStore();
  
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const unreadNotifications = storeNotifications.filter(n => !n.isRead);

  // We sort notifications by date desc
  const sortedNotifications = [...storeNotifications].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getNotificationIcon = (type: Notification['type']) => {
    if (type === 'alert') return <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />;
    if (type === 'success') return <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />;
    return <Info className="h-5 w-5 shrink-0 text-indigo-500" />;
  };

  return (
    <header className="h-14 sm:h-16 bg-white/60 dark:bg-white/5 backdrop-blur-lg border-b border-slate-200 dark:border-white/5 flex items-center px-4 sm:px-8 z-20 shrink-0">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 items-center justify-between">
        <form className="relative flex" onSubmit={(e) => {
          e.preventDefault();
          const search = new FormData(e.currentTarget).get('search');
          if (search) navigate(`/contracts?search=${search}`);
        }}>
          <input
            id="search-field"
            className="bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-full px-10 py-1.5 text-xs w-48 sm:w-64 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400"
            placeholder="بحث عن عقد أو عميل..."
            type="search"
            name="search"
          />
          <Search className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 h-4 w-4 text-slate-400 opacity-40" aria-hidden="true" />
        </form>
        <div className="flex items-center gap-x-2 sm:gap-x-4">
          <Button 
            className="bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all border-none hidden sm:flex"
            onClick={() => navigate('/contracts/new')}
          >
            + إنشاء عقد
          </Button>

          <Button variant="ghost" size="icon" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-full border-none" onClick={toggleTheme}>
            <span className="sr-only">تغيير المظهر</span>
            {theme === 'dark' ? <Sun className="h-4 w-4 sm:h-5 sm:w-5" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
          </Button>
          
          {/* Notifications */}
          <Popover>
            <PopoverTrigger className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }), 
              "relative text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-full border-none"
            )}>
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              {unreadNotifications.length > 0 && (
                <span className="absolute top-1 right-2 sm:top-2 sm:right-2 h-2 w-2 rounded-full bg-rose-500 border border-slate-900"></span>
              )}
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 p-0 text-slate-900 dark:text-white overflow-hidden shadow-2xl">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-white/5">
                <span className="text-sm font-bold flex items-center gap-2">
                  الإشعارات 
                  {unreadNotifications.length > 0 && (
                    <span className="bg-indigo-500 text-white rounded-full px-1.5 py-0.5 text-[10px]">{unreadNotifications.length}</span>
                  )}
                </span>
              </div>
              <div className="max-h-[350px] overflow-y-auto">
                {sortedNotifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs text-muted-foreground">لا توجد إشعارات حالياً</div>
                ) : sortedNotifications.map((n) => (
                  <div 
                    key={n.id} 
                    className={cn(
                      "p-4 border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors flex gap-3",
                      !n.isRead && "bg-indigo-50/50 dark:bg-indigo-500/5"
                    )}
                    onClick={() => markNotificationAsRead(n.id)}
                  >
                    {getNotificationIcon(n.type)}
                    <div className="space-y-1">
                      <p className={cn("text-xs leading-none", !n.isRead ? "font-bold text-slate-900 dark:text-slate-200" : "font-medium text-slate-600 dark:text-slate-300")}>{n.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">{n.message}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 pt-1">
                        {formatDistanceToNow(new Date(n.date), { addSuffix: true, locale: ar })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 text-center bg-slate-50 dark:bg-white/5">
                <Button variant="ghost" size="sm" className="text-xs w-full text-slate-600 dark:text-slate-400" onClick={() => navigate('/collections')}>عرض كل المهام</Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* User Profile */}
          <Popover>
            <PopoverTrigger className={cn(
               buttonVariants({ variant: "ghost", size: "icon" }),
               "relative text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-full border-none w-auto px-2 pl-3 gap-2"
            )}>
              <UserCircle2 className="h-5 w-5 sm:h-6 sm:w-6" />
              <div className="hidden sm:flex flex-col items-start leading-none pointer-events-none text-right gap-0.5">
                <span className="text-[11px] font-bold">{currentUser?.name}</span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">{currentUser?.role}</span>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-56 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 p-2 text-slate-900 dark:text-white shadow-2xl">
              <div className="p-2 border-b border-slate-200 dark:border-white/5 mb-2">
                <p className="text-sm font-bold">{currentUser?.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{currentUser?.email}</p>
              </div>
              <Button variant="ghost" className="w-full justify-start text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 gap-2" onClick={handleLogout}>
                <LogOut className="h-4 w-4" /> تسجيل الخروج
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </header>
  );
}
