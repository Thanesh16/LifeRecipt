import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Menu, Plus, Activity, CheckCircle2, Bell } from 'lucide-react';
import Button from '../common/Button';
import dashboardService from '../../services/dashboardService';
import alertService from '../../services/alertService';

const routeTitleMap = {
  '/dashboard': 'Dashboard Overview',
  '/products': 'My Products Catalog',
  '/add-purchase': 'Add Purchase & Warranty',
  '/alerts': 'Warranty & Claim Alerts',
  '/analytics': 'Ownership Intelligence & Depreciation',
  '/documents': 'Digital Document Vault',
  '/timeline': 'Ownership Timeline Activity',
  '/assistant': 'AI Digital Ownership Assistant',
  '/settings': 'Account & Platform Settings',
};

export const Header = ({ onOpenMobileNav }) => {
  const location = useLocation();
  const [backendHealth, setBackendHealth] = useState({ online: true, db: 'CONNECTED' });
  const [unreadCount, setUnreadCount] = useState(0);

  // Compute title based on current pathname
  const currentTitle =
    routeTitleMap[location.pathname] ||
    (location.pathname.startsWith('/products/') ? 'Product Details' : 'LifeReceipt');

  useEffect(() => {
    let isMounted = true;
    const checkHealthAndAlerts = async () => {
      try {
        const [res, alertsRes] = await Promise.all([
          dashboardService.getHealth(),
          alertService.getUnreadCount().catch(() => ({ data: { unreadCount: 0 } })),
        ]);

        if (isMounted) {
          if (res.success) {
            setBackendHealth({
              online: true,
              db: res.data?.database || 'CONNECTED',
            });
          }
          if (alertsRes?.data?.unreadCount !== undefined) {
            setUnreadCount(alertsRes.data.unreadCount);
          }
        }
      } catch {
        if (isMounted) {
          setBackendHealth({ online: false, db: 'UNREACHABLE' });
        }
      }
    };

    checkHealthAndAlerts();
    const interval = setInterval(checkHealthAndAlerts, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [location.pathname]);

  return (
    <header className="h-16 px-4 md:px-8 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Toggle */}
        <button
          onClick={onOpenMobileNav}
          className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 focus:outline-none"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-sm md:text-base font-semibold text-slate-100 tracking-tight">
            {currentTitle}
          </h1>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Personal Ownership & Asset Intelligence
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Backend & DB Status indicator */}
        <div
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-300"
          title={`Backend status: ${backendHealth.online ? 'Online' : 'Offline'} | Database: ${backendHealth.db}`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              backendHealth.online && backendHealth.db === 'CONNECTED'
                ? 'bg-emerald-400 animate-pulse'
                : 'bg-rose-400'
            }`}
          />
          <span className="font-mono text-[10px] text-slate-400">
            {backendHealth.db === 'CONNECTED' ? 'DB CONNECTED' : 'OFFLINE'}
          </span>
        </div>

        {/* Alerts Bell Notification Icon with Badge */}
        <Link
          to="/alerts"
          className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 transition-colors"
          title="View Alerts & Deadlines"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-slate-950">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        {/* Quick Action Button */}
        <Link to="/add-purchase">
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            <span className="hidden xs:inline">Add Purchase</span>
            <span className="xs:hidden">Add</span>
          </Button>
        </Link>
      </div>
    </header>
  );
};

export default Header;
