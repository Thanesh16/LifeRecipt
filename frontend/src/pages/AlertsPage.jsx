import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BellRing,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  RotateCcw,
  CheckCircle2,
  CheckCheck,
  Clock,
  ExternalLink,
  Package,
  AlertTriangle,
  RefreshCw,
  Filter,
} from 'lucide-react';
import alertService from '../services/alertService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { formatDate, formatCurrency } from '../utils/formatters';

export const AlertsPage = () => {
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all', 'warranty', 'return', 'unread'
  const [selectedPriority, setSelectedPriority] = useState('all'); // 'all', 'HIGH', 'MEDIUM', 'LOW', 'INFO'
  const [error, setError] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedCategory === 'warranty') {
        params.category = 'warranty';
      } else if (selectedCategory === 'return') {
        params.category = 'return';
      } else if (selectedCategory === 'unread') {
        params.isRead = 'false';
      }

      if (selectedPriority !== 'all') {
        params.priority = selectedPriority;
      }

      const res = await alertService.getAlerts(params);
      if (res.success && res.data) {
        setAlerts(res.data.alerts || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load smart alerts');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedPriority]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleMarkAsRead = async (id, e) => {
    e?.stopPropagation();
    setActionInProgress(true);
    try {
      await alertService.markAsRead(id);
      setAlerts((prev) =>
        prev.map((a) => (a._id === id ? { ...a, isRead: true } : a))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update alert');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    setActionInProgress(true);
    try {
      await alertService.markAllAsRead();
      setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to mark all as read');
    } finally {
      setActionInProgress(false);
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/25 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping mr-0.5" />
            Critical Action
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25 uppercase">
            Expiring Soon
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
            Notice
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            Info
          </span>
        );
    }
  };

  const getAlertIcon = (type, priority) => {
    if (type.startsWith('WARRANTY')) {
      if (priority === 'HIGH' || priority === 'MEDIUM') {
        return <ShieldAlert className="w-5 h-5 text-amber-400" />;
      }
      return <ShieldX className="w-5 h-5 text-slate-400" />;
    }
    if (type.startsWith('RETURN')) {
      return <RotateCcw className={`w-5 h-5 ${priority === 'HIGH' ? 'text-rose-400' : 'text-sky-400'}`} />;
    }
    return <BellRing className="w-5 h-5 text-sky-400" />;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Smart Alerts & Deadline Intelligence
            </h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {unreadCount} Unread
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time proactive monitoring for warranties, return periods, and ownership deadlines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAlerts}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            disabled={loading}
          >
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMarkAllAsRead}
              leftIcon={<CheckCheck className="w-3.5 h-3.5" />}
              isLoading={actionInProgress}
            >
              Mark All as Read
            </Button>
          )}
        </div>
      </div>

      {/* Tabs & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              selectedCategory === 'all'
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            All Alerts
          </button>
          <button
            onClick={() => setSelectedCategory('warranty')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              selectedCategory === 'warranty'
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Warranty Alerts
          </button>
          <button
            onClick={() => setSelectedCategory('return')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              selectedCategory === 'return'
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Return Deadlines
          </button>
          <button
            onClick={() => setSelectedCategory('unread')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              selectedCategory === 'unread'
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Unread Only ({unreadCount})
          </button>
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Priority:</span>
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-900/90 py-1.5 px-2.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="HIGH">Critical Action (High)</option>
            <option value="MEDIUM">Expiring Soon (Medium)</option>
            <option value="LOW">Notices (Low)</option>
            <option value="INFO">Info</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Alerts Feed */}
      {loading ? (
        <LoadingSpinner label="Evaluating product deadlines & synchronizing alerts..." size="lg" />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title="All Deadlines in Good Standing"
          description={
            selectedCategory === 'unread'
              ? 'You have read all pending notifications. No unread alerts at this time.'
              : selectedCategory === 'warranty'
              ? 'No warranties are currently nearing expiration or requiring immediate claim actions.'
              : selectedCategory === 'return'
              ? 'No return windows are currently active or expiring within active thresholds.'
              : 'All registered assets and warranty protections are in good standing. Alerts generate automatically when deadlines approach.'
          }
          badgeText="Alert Monitor Active"
          upcomingFeatures={[
            'Automated email notification dispatch configured to user preferences',
            'Configurable 30-day and 7-day expiration warning thresholds',
            'Instant deep linking to relevant product warranty cards',
          ]}
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const isUnread = !alert.isRead;
            const product = alert.productId;

            return (
              <div
                key={alert._id}
                onClick={() => product?._id && navigate(`/products/${product._id}`)}
                className={`p-4 sm:p-5 rounded-xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group ${
                  isUnread
                    ? 'bg-slate-900/90 border-amber-500/30 hover:border-amber-500/60 shadow-lg shadow-amber-500/5'
                    : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`p-2.5 rounded-xl border shrink-0 mt-0.5 ${
                      alert.priority === 'HIGH'
                        ? 'bg-rose-500/10 border-rose-500/20'
                        : alert.priority === 'MEDIUM'
                        ? 'bg-amber-500/10 border-amber-500/20'
                        : 'bg-slate-800/80 border-slate-700/80'
                    }`}
                  >
                    {getAlertIcon(alert.type, alert.priority)}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4
                        className={`text-sm font-semibold tracking-tight group-hover:text-sky-300 transition-colors ${
                          isUnread ? 'text-white' : 'text-slate-300'
                        }`}
                      >
                        {alert.title}
                      </h4>
                      {getPriorityBadge(alert.priority)}
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 ring-4 ring-amber-400/20" />
                      )}
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                      {alert.message}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400">
                      {product && (
                        <span className="flex items-center gap-1 font-medium text-slate-300">
                          <Package className="w-3.5 h-3.5 text-sky-400" />
                          {product.productName}
                          {product.purchasePrice > 0 && ` (${formatCurrency(product.purchasePrice, product.currency)})`}
                        </span>
                      )}

                      {alert.relevantDate && (
                        <span className="flex items-center gap-1 text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                          Deadline: {formatDate(alert.relevantDate)}
                        </span>
                      )}

                      <span className="text-slate-400">
                        Generated {formatDate(alert.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {isUnread && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => handleMarkAsRead(alert._id, e)}
                      leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />}
                    >
                      Mark Read
                    </Button>
                  )}

                  {product?._id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/products/${product._id}`);
                      }}
                      rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                    >
                      View Product
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AlertsPage;
