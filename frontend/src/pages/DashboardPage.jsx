import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Package,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  Receipt,
  Plus,
  ArrowRight,
  Sparkles,
  FileText,
  Clock,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ArrowRightLeft,
  Mail,
} from 'lucide-react';
import StatCard from '../components/common/StatCard';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import dashboardService from '../services/dashboardService';
import lifecycleService from '../services/lifecycleService';
import emailReceiptService from '../services/emailReceiptService';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { calculateWarrantyStatus, calculateReturnStatus } from '../utils/statusCalculator';

export const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    metrics: {
      totalProducts: 0,
      activeWarranties: 0,
      expiringSoon: 0,
      activeReturns: 0,
      totalTrackedValue: 0,
      currency: 'INR',
    },
    recentPurchases: [],
    recentActivity: [],
    upcomingActions: [],
  });
  const [lifecycleSummary, setLifecycleSummary] = useState(null);
  const [emailPendingCount, setEmailPendingCount] = useState(0);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [response, lifeRes, emailRes] = await Promise.all([
        dashboardService.getDashboardSummary(),
        lifecycleService.getSummary().catch(() => ({ success: false, data: null })),
        emailReceiptService.getCandidates({ tab: 'needs_review' }).catch(() => ({ success: false, candidates: [] })),
      ]);
      if (response.success && response.data) {
        setData(response.data);
      }
      if (lifeRes?.success && lifeRes.data) {
        setLifecycleSummary(lifeRes.data);
      }
      if (emailRes?.candidates) {
        setEmailPendingCount(emailRes.candidates.length);
      } else if (Array.isArray(emailRes?.data)) {
        setEmailPendingCount(emailRes.data.length);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return <LoadingSpinner label="Querying real-time ledger metrics..." size="lg" />;
  }

  const { metrics, recentPurchases, recentActivity, upcomingActions } = data;

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-sky-950/40 via-slate-900/60 to-slate-950 border border-sky-500/20">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[11px] font-semibold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified User Ledger Active
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Welcome back, {user?.name || 'Owner'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Tracking {metrics.totalProducts} asset{metrics.totalProducts === 1 ? '' : 's'} worth {formatCurrency(metrics.totalTrackedValue, metrics.currency)} in your isolated vault.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Data
          </Button>
          <Link to="/add-purchase">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Purchase
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* 4 CORE METRIC CARDS (Exact Phase 2 Requirements) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Total Products"
          value={metrics.totalProducts}
          icon={Package}
          colorScheme="sky"
          description={
            metrics.totalProducts === 0
              ? 'No items cataloged yet'
              : `${formatCurrency(metrics.totalTrackedValue, metrics.currency)} total value`
          }
        />

        <StatCard
          title="Active Warranties"
          value={metrics.activeWarranties}
          icon={ShieldCheck}
          colorScheme="emerald"
          description={
            metrics.activeWarranties === 0
              ? 'No active warranties'
              : `${metrics.activeWarranties} protected device${metrics.activeWarranties === 1 ? '' : 's'}`
          }
        />

        <StatCard
          title="Warranties Expiring Soon"
          value={metrics.expiringSoon}
          icon={ShieldAlert}
          colorScheme="amber"
          description="Within 30-day window"
        />

        <StatCard
          title="Active Return Periods"
          value={metrics.activeReturns ?? 0}
          icon={RotateCcw}
          colorScheme="purple"
          description={
            (metrics.activeReturns ?? 0) === 0
              ? 'No open return windows'
              : `${metrics.activeReturns} returnable item${metrics.activeReturns === 1 ? '' : 's'}`
          }
        />
      </div>

      {/* Lifecycle & Chain of Custody Portfolio Widget */}
      {lifecycleSummary && (
        <Card
          title="Product Lifecycle & Custody Portfolio"
          subtitle="Real-time lifecycle distribution, record completeness & chain of custody"
          action={
            <Link
              to="/transfers"
              className="text-xs font-semibold text-primary-400 hover:text-primary-300 flex items-center gap-1"
            >
              <span>Transfers Hub</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Avg Record Completeness */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Record Completeness</span>
                <span className="font-bold text-primary-400 font-mono">
                  {lifecycleSummary.averageCompleteness}%
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    lifecycleSummary.averageCompleteness >= 80
                      ? 'bg-emerald-500'
                      : lifecycleSummary.averageCompleteness >= 50
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${lifecycleSummary.averageCompleteness}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                {lifecycleSummary.incompleteRecordsCount} incomplete asset record{lifecycleSummary.incompleteRecordsCount === 1 ? '' : 's'}
              </p>
            </div>

            {/* In Active Ownership */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium block">Active Custody</span>
              <span className="text-2xl font-bold text-white font-mono block">
                {(lifecycleSummary.stages?.ACTIVE_OWNERSHIP || 0) +
                  (lifecycleSummary.stages?.WARRANTY_ACTIVE || 0) +
                  (lifecycleSummary.stages?.RETURN_PERIOD || 0) +
                  (lifecycleSummary.stages?.LONG_TERM_OWNERSHIP || 0)}
              </span>
              <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {lifecycleSummary.stages?.WARRANTY_ACTIVE || 0} under warranty
              </span>
            </div>

            {/* Pending Handshakes */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium block">Transfer Handshakes</span>
              <span className="text-2xl font-bold text-amber-400 font-mono block">
                {lifecycleSummary.stages?.TRANSFER_PENDING || 0}
              </span>
              <Link
                to="/transfers"
                className="text-[11px] text-amber-300 hover:text-amber-200 flex items-center gap-1 font-medium"
              >
                <ArrowRightLeft className="w-3 h-3" />
                Review incoming & outgoing
              </Link>
            </div>

            {/* Lifecycle Stages Breakdown */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 font-medium block">Stage Distribution</span>
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                {(lifecycleSummary.stages?.WARRANTY_ACTIVE || 0) > 0 && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                    Warranty Active ({lifecycleSummary.stages.WARRANTY_ACTIVE})
                  </span>
                )}
                {(lifecycleSummary.stages?.RETURN_PERIOD || 0) > 0 && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                    Return Period ({lifecycleSummary.stages.RETURN_PERIOD})
                  </span>
                )}
                {(lifecycleSummary.stages?.WARRANTY_EXPIRED || 0) > 0 && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                    Expired ({lifecycleSummary.stages.WARRANTY_EXPIRED})
                  </span>
                )}
                {(lifecycleSummary.stages?.TRANSFER_PENDING || 0) > 0 && (
                  <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium">
                    Transferring ({lifecycleSummary.stages.TRANSFER_PENDING})
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Actions Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <button
            onClick={() => navigate('/add-purchase')}
            className="flex items-center gap-3.5 p-4 rounded-xl border border-slate-800/80 bg-slate-900/50 hover:bg-slate-900 hover:border-sky-500/40 text-left transition-all group"
          >
            <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 group-hover:bg-sky-500 group-hover:text-slate-950 transition-colors">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">Add Purchase</p>
              <p className="text-xs text-slate-400">Catalog new product & warranty</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/products')}
            className="flex items-center gap-3.5 p-4 rounded-xl border border-slate-800/80 bg-slate-900/50 hover:bg-slate-900 hover:border-sky-500/40 text-left transition-all group"
          >
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">View Products</p>
              <p className="text-xs text-slate-400">Catalog, filters & serials</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/email-receipts')}
            className="flex items-center gap-3.5 p-4 rounded-xl border border-slate-800/80 bg-slate-900/50 hover:bg-slate-900 hover:border-indigo-500/40 text-left transition-all group relative"
          >
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-slate-100">Email Sync</p>
                {emailPendingCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-500 text-white shadow-sm">
                    {emailPendingCount}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Discovered receipts inbox</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/transfers')}
            className="flex items-center gap-3.5 p-4 rounded-xl border border-slate-800/80 bg-slate-900/50 hover:bg-slate-900 hover:border-primary-500/40 text-left transition-all group"
          >
            <div className="p-2.5 rounded-lg bg-primary-500/10 text-primary-400 group-hover:bg-primary-500 group-hover:text-slate-950 transition-colors">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">Transfers</p>
              <p className="text-xs text-slate-400">Incoming & outgoing custody</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/documents')}
            className="flex items-center gap-3.5 p-4 rounded-xl border border-slate-800/80 bg-slate-900/50 hover:bg-slate-900 hover:border-sky-500/40 text-left transition-all group"
          >
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">View Documents</p>
              <p className="text-xs text-slate-400">Receipts, invoices & manuals</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/assistant')}
            className="flex items-center gap-3.5 p-4 rounded-xl border border-slate-800/80 bg-slate-900/50 hover:bg-slate-900 hover:border-sky-500/40 text-left transition-all group"
          >
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-slate-950 transition-colors">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">Ask AI</p>
              <p className="text-xs text-slate-400">Claim advice & DIY diagnostics</p>
            </div>
          </button>
        </div>
      </div>

      {/* Grid for Recent Purchases & Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Purchases (2 cols) */}
        <div className="lg:col-span-2">
          <Card
            title="Recent Purchases"
            subtitle="Latest verified additions to your authenticated ownership ledger"
            action={
              <Link
                to="/products"
                className="text-xs font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                <span>View all ({metrics.totalProducts})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            }
          >
            {recentPurchases.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-400 mb-3">
                  <Receipt className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-medium text-slate-200">
                  No purchases recorded yet
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
                  Add your first product to activate warranty monitoring, return window alerts, and asset value intelligence.
                </p>
                <Link to="/add-purchase">
                  <Button size="sm" variant="secondary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
                    Add First Product
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {recentPurchases.map((product) => (
                  <Link
                    key={product._id}
                    to={`/products/${product._id}`}
                    className="py-3 flex items-center justify-between hover:bg-slate-800/40 px-2 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-100 group-hover:text-sky-400 transition-colors">
                          {product.productName}
                        </p>
                        <p className="text-xs text-slate-400">
                          {product.brand || product.category}
                          {product.sellerName && ` • ${product.sellerName}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-200">
                        {formatCurrency(product.purchasePrice, product.currency)}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {formatDate(product.purchaseDate)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Upcoming Actions (1 col) */}
        <div className="space-y-6">
          <Card
            title="Upcoming Actions"
            subtitle="Impending deadlines & reminders"
          >
            {upcomingActions.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-semibold text-slate-200">
                  All Clear
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  No warranties or return windows are expiring within active warning thresholds.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingActions.map((item) => {
                  const wStatus = calculateWarrantyStatus(item.warranty);
                  const rStatus = calculateReturnStatus(item.returnInfo);

                  return (
                    <Link
                      key={item._id}
                      to={`/products/${item._id}`}
                      className="block p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-amber-300 truncate">
                          {item.productName}
                        </p>
                        {wStatus.isExpiringSoon && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            wStatus.isCritical ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {wStatus.label}
                          </span>
                        )}
                      </div>
                      {wStatus.isExpiringSoon && (
                        <p className="text-[11px] text-amber-400/90 mt-1 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 shrink-0" />
                          Warranty expires {formatDate(item.warranty.warrantyEndDate)}
                        </p>
                      )}
                      {rStatus.isExpiringSoon && (
                        <p className="text-[11px] text-sky-400/90 mt-1 flex items-center gap-1">
                          <RotateCcw className="w-3 h-3 shrink-0" />
                          Return: {rStatus.label} ({formatDate(item.returnInfo.returnEndDate)})
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>

          <Card
            title="Recent Activity"
            subtitle="Ownership audit log"
          >
            <div className="py-6 text-center flex flex-col items-center justify-center">
              <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center mb-2">
                <Clock className="w-4 h-4" />
              </div>
              <p className="text-xs text-slate-400">
                {metrics.totalProducts > 0
                  ? `${metrics.totalProducts} asset${metrics.totalProducts === 1 ? '' : 's'} registered in active ownership ledger.`
                  : 'Activity log is empty. Events will log as products and warranties are cataloged.'}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
