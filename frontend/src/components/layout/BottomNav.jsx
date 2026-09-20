import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Plus,
  Wrench,
  BellRing,
  Menu,
  WifiOff,
} from 'lucide-react';
import alertService from '../../services/alertService';

export const BottomNav = ({ onOpenMore }) => {
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    let isMounted = true;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const fetchAlerts = async () => {
      try {
        const res = await alertService.getUnreadCount();
        if (isMounted && res?.data?.unreadCount !== undefined) {
          setUnreadCount(res.data.unreadCount);
        }
      } catch {
        // graceful ignore
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [location.pathname]);

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/products', label: 'Products', icon: Package },
    { to: '/add-purchase', label: 'Add', icon: Plus, isAction: true },
    { to: '/services', label: 'Services', icon: Wrench },
    { to: '/alerts', label: 'Alerts', icon: BellRing, badge: unreadCount },
  ];

  return (
    <>
      {/* Offline Fallback Banner */}
      {isOffline && (
        <div className="fixed top-16 left-0 right-0 z-50 bg-amber-500/90 backdrop-blur text-slate-950 px-3 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 shadow-lg">
          <WifiOff className="w-3.5 h-3.5" />
          <span>You are offline. Some LifeReceipt features require an internet connection.</span>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-slate-950/95 backdrop-blur border-t border-slate-800/80 px-2 py-1 flex items-center justify-around select-none safe-area-pb"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          if (item.isAction) {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="relative -top-2.5 flex flex-col items-center justify-center p-2 group"
                aria-label="Add Purchase"
              >
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-sky-500 to-sky-400 text-slate-950 flex items-center justify-center shadow-lg shadow-sky-500/30 group-hover:scale-105 active:scale-95 transition-transform">
                  <Plus className="w-6 h-6 stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-semibold text-sky-400 mt-0.5">
                  {item.label}
                </span>
              </NavLink>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center min-w-[54px] min-h-[44px] py-1 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
                }`
              }
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-amber-500 px-1 text-[8px] font-bold text-slate-950">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className="mt-0.5">{item.label}</span>
            </NavLink>
          );
        })}

        {/* More Options Button (Triggers Drawer) */}
        <button
          type="button"
          onClick={onOpenMore}
          aria-label="More navigation options"
          className="flex flex-col items-center justify-center min-w-[54px] min-h-[44px] py-1 text-[10px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span className="mt-0.5">More</span>
        </button>
      </nav>
    </>
  );
};

export default BottomNav;
