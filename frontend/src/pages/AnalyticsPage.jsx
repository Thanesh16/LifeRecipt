import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Wrench,
  ShieldAlert,
  PieChart,
  BarChart3,
  Sparkles,
  Layers,
  FileText,
  AlertCircle,
  ArrowRight,
  Clock,
  Tag,
  RefreshCw,
  HelpCircle,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import analyticsService from '../services/analyticsService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { formatCurrency } from '../utils/formatters';

const CATEGORY_COLORS = {
  REPAIR: { bg: 'bg-rose-500', text: 'text-rose-400', border: 'border-rose-500/20' },
  SERVICE: { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/20' },
  MAINTENANCE: { bg: 'bg-sky-500', text: 'text-sky-400', border: 'border-sky-500/20' },
  ACCESSORY: { bg: 'bg-violet-500', text: 'text-violet-400', border: 'border-violet-500/20' },
  REPLACEMENT: { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  OTHER: { bg: 'bg-slate-500', text: 'text-slate-400', border: 'border-slate-500/20' },
};

const getInsightBadgeStyle = (level) => {
  switch (level) {
    case 'WARNING':
      return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    case 'ACTION_REQUIRED':
      return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    case 'INFO':
    default:
      return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
  }
};

export const AnalyticsPage = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [insightsData, setInsightsData] = useState(null);
  const [error, setError] = useState(null);

  const fetchAnalyticsAndInsights = async () => {
    try {
      setError(null);
      const [analyticsRes, insightsRes] = await Promise.all([
        analyticsService.getGlobalOwnershipCost(),
        analyticsService.getGlobalInsights(),
      ]);

      if (analyticsRes.success) {
        setAnalyticsData(analyticsRes.data);
      }
      if (insightsRes.success) {
        setInsightsData(insightsRes.data);
      }
    } catch (err) {
      console.error('[Analytics Error]', err);
      setError(err.response?.data?.message || 'Failed to load ownership cost analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsAndInsights();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalyticsAndInsights();
  };

  if (loading) {
    return (
      <div className="py-16 text-center">
        <LoadingSpinner size="lg" label="Aggregating ownership costs & financial metrics..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
        <Button size="sm" variant="secondary" onClick={handleRefresh}>
          Retry
        </Button>
      </div>
    );
  }

  const {
    totalProducts = 0,
    totalPurchaseCost = 0,
    additionalOwnershipCost = 0,
    totalOwnershipCost = 0,
    globalAdditionalPercentage = 0,
    categoryBreakdown = {},
    monthlyExpenses = [],
    productComparisons = [],
  } = analyticsData || {};

  const insightsList = insightsData?.insights || [];

  // If no products at all
  if (totalProducts === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Ownership Cost Analytics & AI Insights
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministic financial analytics, expense tracking, and factual pattern analysis.
          </p>
        </div>

        <EmptyState
          icon={BarChart3}
          title="No Products Registered"
          description="Register physical items into your digital ownership ledger to begin calculating true ownership costs and receiving AI insights."
          badgeText="Ownership Ledger"
          upcomingFeatures={[
            'Purchase vs repair & maintenance cost breakdown',
            'Factual AI alerts for warranty-period repair eligibility',
            'Monthly asset expense trends and category distributions',
            'Portfolio-wide ownership cost concentration reporting',
          ]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header with Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Ownership Cost Analytics & AI Insights
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministic lifecycle cost intelligence, expense distributions, and factual AI pattern analysis.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Metrics'}
          </Button>
        </div>
      </div>

      {/* Summary Stat Cards (4 columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-medium">Total Products</span>
            <Layers className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{totalProducts}</div>
          <p className="text-[11px] text-slate-400 mt-1">Registered physical assets</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-medium">Total Purchase Cost</span>
            <IndianRupee className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {formatCurrency(totalPurchaseCost)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Authoritative initial acquisition</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-medium">Additional Ownership Costs</span>
            <Wrench className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-300">
            {formatCurrency(additionalOwnershipCost)}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
              +{globalAdditionalPercentage}% of purchase
            </span>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-medium">Total Ownership Cost</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {formatCurrency(totalOwnershipCost)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Purchase + recorded expenses</p>
        </Card>
      </div>

      {/* AI Ownership Insights Section */}
      <Card
        title="AI Ownership Insights"
        subtitle="Factual pattern detection based on verified metrics and document records"
      >
        {insightsList.length === 0 ? (
          <div className="py-6 text-center flex flex-col items-center justify-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-400 max-w-md">
              There isn't enough recorded ownership data to generate meaningful insights yet. Record additional expenses or attach documents to activate intelligence alerts.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {insightsList.map((ins, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700/80 transition-colors flex flex-col justify-between space-y-2.5"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${getInsightBadgeStyle(
                        ins.level
                      )}`}
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      {ins.level === 'WARNING'
                        ? 'High Attention'
                        : ins.level === 'ACTION_REQUIRED'
                        ? 'Action Suggested'
                        : 'Ownership Metric'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {ins.type}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-100">{ins.title}</h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {ins.description}
                  </p>
                </div>

                {ins.metric && (
                  <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                    {Object.entries(ins.metric).map(([k, v], mIdx) => (
                      <span key={mIdx} className="text-slate-400">
                        <span className="text-slate-400 capitalize">{k.replace(/([A-Z])/g, ' $1')}:</span>{' '}
                        <span className="text-slate-200 font-semibold">{v}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Visual Charts: Spending by Category & Monthly Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending by Category */}
        <Card
          title="Spending by Expense Category"
          subtitle="Distribution of additional ownership costs"
        >
          {additionalOwnershipCost === 0 ? (
            <div className="py-8 text-center flex flex-col items-center justify-center space-y-2">
              <PieChart className="w-8 h-8 text-slate-500" />
              <p className="text-xs text-slate-400">No additional ownership expenses recorded yet.</p>
              <p className="text-[11px] text-slate-400">Add repairs, accessories, or maintenance to see category breakdowns.</p>
            </div>
          ) : (
            <div className="space-y-3.5 pt-1">
              {Object.entries(categoryBreakdown).map(([catKey, amt]) => {
                const percentage =
                  additionalOwnershipCost > 0
                    ? Math.round((amt / additionalOwnershipCost) * 100)
                    : 0;
                const colors = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.OTHER;

                return (
                  <div key={catKey} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium capitalize">
                        {catKey.toLowerCase()}
                      </span>
                      <span className="text-slate-400 font-mono">
                        {formatCurrency(amt)}{' '}
                        <span className="text-slate-400">({percentage}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800/80">
                      <div
                        className={`h-full rounded-full ${colors.bg}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Monthly Expenses Timeline */}
        <Card
          title="Monthly Ownership Expenses"
          subtitle="Expense progression over time based on expense date"
        >
          {monthlyExpenses.length === 0 ? (
            <div className="py-8 text-center flex flex-col items-center justify-center space-y-2">
              <Calendar className="w-8 h-8 text-slate-500" />
              <p className="text-xs text-slate-400">No dated expenses recorded yet.</p>
              <p className="text-[11px] text-slate-400">Recorded expenses will map to a chronological monthly timeline.</p>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {monthlyExpenses.map((m) => (
                <div
                  key={m.month}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    <span className="font-semibold text-slate-200">{m.monthLabel}</span>
                    <span className="text-[10px] text-slate-400">
                      ({m.expenseCount} {m.expenseCount === 1 ? 'expense' : 'expenses'})
                    </span>
                  </div>
                  <span className="font-bold text-amber-300 font-mono">
                    {formatCurrency(m.totalAmount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Product Ownership Cost Comparison Table */}
      <Card
        title="Product Ownership Cost Breakdown"
        subtitle="Purchase vs. additional costs across all registered products"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium uppercase tracking-wider text-[10px]">
                <th className="pb-2.5 pl-2">Product</th>
                <th className="pb-2.5">Category</th>
                <th className="pb-2.5 text-right">Purchase Cost</th>
                <th className="pb-2.5 text-right">Additional Costs</th>
                <th className="pb-2.5 text-right">Total Cost</th>
                <th className="pb-2.5 text-right">Add'l %</th>
                <th className="pb-2.5 pr-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {productComparisons.map((item) => (
                <tr key={item.productId} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3 pl-2 font-medium text-white">
                    <div className="flex flex-col">
                      <span>{item.productName}</span>
                      {item.brand && (
                        <span className="text-[10px] text-slate-400">
                          {item.brand} {item.model}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                      {item.category}
                    </span>
                  </td>
                  <td className="py-3 text-right font-mono text-slate-300">
                    {formatCurrency(item.purchaseCost)}
                  </td>
                  <td className="py-3 text-right font-mono text-amber-300">
                    {item.additionalCost > 0 ? formatCurrency(item.additionalCost) : '₹0'}
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-white">
                    {formatCurrency(item.totalOwnershipCost)}
                  </td>
                  <td className="py-3 text-right font-mono">
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        item.additionalCostPercentage > 20
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : item.additionalCostPercentage > 0
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'text-slate-400'
                      }`}
                    >
                      {item.additionalCostPercentage}%
                    </span>
                  </td>
                  <td className="py-3 pr-2 text-right">
                    <Link
                      to={`/products/${item.productId}`}
                      className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 hover:underline"
                    >
                      View <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default AnalyticsPage;
