import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  BellRing,
  BarChart3,
  FileText,
  History,
  Bot,
  Settings,
  LogOut,
  ShieldCheck,
  ArrowRightLeft,
  Mail,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import alertService from '../../services/alertService';
import emailReceiptService from '../../services/emailReceiptService';

export const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/products', label: 'My Products', icon: Package },
  { path: '/add-purchase', label: 'Add Purchase', icon: PlusCircle },
  { path: '/email-receipts', label: 'Email Receipts', icon: Mail },
  { path: '/services', label: 'Services & Claims', icon: Wrench },
  { path: '/transfers', label: 'Transfers', icon: ArrowRightLeft },
  { path: '/alerts', label: 'Alerts', icon: BellRing },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/documents', label: 'Documents', icon: FileText },
  { path: '/timeline', label: 'Timeline', icon: History },
  { path: '/assistant', label: 'AI Assistant', icon: Bot },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export const Sidebar = ({ onNavigate }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [emailPendingCount, setEmailPendingCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchCounters = async () => {
      try {
        const [alertRes, emailRes] = await Promise.allSettled([
          alertService.getUnreadCount(),
          emailReceiptService.getCandidates({ tab: 'needs_review' }),
        ]);

        if (isMounted && alertRes.status === 'fulfilled' && alertRes.value?.data?.unreadCount !== undefined) {
          setUnreadCount(alertRes.value.data.unreadCount);
        }

        if (isMounted && emailRes.status === 'fulfilled') {
          const count = emailRes.value?.candidates?.length ?? (Array.isArray(emailRes.value?.data) ? emailRes.value.data.length : 0);
          setEmailPendingCount(count);
        }
      } catch {
        // graceful ignore
      }
    };

    fetchCounters();
    const interval = setInterval(fetchCounters, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <aside className="w-64 h-full flex flex-col bg-slate-950 border-r border-slate-800/80 select-none">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800/80">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-slate-950 shadow-md shadow-sky-500/20">
          <ShieldCheck className="w-5 h-5 font-bold" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
            LIFERECEIPT
            <span className="text-[9px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1 py-0.2 rounded">
              v1.0
            </span>
          </span>
          <span className="text-[10px] text-slate-400 font-medium truncate">
            Ownership Intelligence
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Platform Menu
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.path === '/alerts' && unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              {item.path === '/email-receipts' && emailPendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-500 text-white shadow-sm shadow-indigo-500/40">
                  {emailPendingCount > 99 ? '99+' : emailPendingCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* User Profile & Logout Area */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/40">
        <div className="flex items-center gap-3 p-2 rounded-lg mb-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 text-sky-300 font-semibold text-xs flex items-center justify-center shrink-0">
            {getInitials(user?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">
              {user?.name || 'User'}
            </p>
            <p className="text-[11px] text-slate-400 truncate">
              {user?.email || ''}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg border border-transparent hover:border-rose-500/20 transition-colors"
          title="Sign out of LifeReceipt"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
