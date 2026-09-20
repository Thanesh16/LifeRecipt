import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Package,
  Plus,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RotateCcw,
  Trash2,
  ExternalLink,
  Tag,
  Building,
  Calendar,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import productService from '../services/productService';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatCurrency, formatDate } from '../utils/formatters';
import { calculateWarrantyStatus, calculateReturnStatus } from '../utils/statusCalculator';

const CATEGORIES = [
  'All',
  'Electronics',
  'Appliances',
  'Automotive',
  'Home & Furniture',
  'Computing',
  'Personal & Apparel',
  'Tools & Hardware',
  'Sports & Outdoors',
  'Other',
];

export const ProductsPage = () => {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [warrantyFilter, setWarrantyFilter] = useState('all');
  const [returnFilter, setReturnFilter] = useState('all');
  const [lifecycleFilter, setLifecycleFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [deleteModalId, setDeleteModalId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedCategory !== 'All') params.category = selectedCategory;
      if (search.trim()) params.search = search.trim();
      if (warrantyFilter !== 'all') params.warrantyStatus = warrantyFilter;
      if (returnFilter !== 'all') params.returnStatus = returnFilter;
      if (lifecycleFilter !== 'all') {
        if (lifecycleFilter === 'Transfer Pending' || lifecycleFilter === 'Sold' || lifecycleFilter === 'Disposed') {
          params.status = lifecycleFilter;
        } else if (lifecycleFilter === 'WARRANTY_ACTIVE') {
          params.warrantyStatus = 'active';
        } else if (lifecycleFilter === 'RETURN_PERIOD') {
          params.returnStatus = 'eligible';
        } else if (lifecycleFilter === 'WARRANTY_EXPIRED') {
          params.warrantyStatus = 'expired';
        }
      }
      if (sortBy) params.sort = sortBy;

      const res = await productService.getProducts(params);
      if (res.success && res.data) {
        setProducts(res.data.products || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve products');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, search, warrantyFilter, returnFilter, lifecycleFilter, sortBy]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 250); // slight debounce for search
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const handleDelete = async (id) => {
    setIsDeleting(true);
    try {
      await productService.deleteProduct(id);
      setDeleteModalId(null);
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete product');
    } finally {
      setIsDeleting(false);
    }
  };

  const getWarrantyBadge = (warranty) => {
    const ws = calculateWarrantyStatus(warranty);
    if (ws.status === 'NO_WARRANTY') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400">
          <ShieldX className="w-3 h-3" />
          No Warranty
        </span>
      );
    }
    if (ws.status === 'UNKNOWN') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
          <ShieldCheck className="w-3 h-3" />
          {ws.label}
        </span>
      );
    }
    if (ws.status === 'EXPIRED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <ShieldX className="w-3 h-3" />
          Expired
        </span>
      );
    }
    if (ws.status === 'EXPIRING_SOON') {
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
          ws.isCritical ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        }`}>
          <ShieldAlert className="w-3 h-3" />
          {ws.label}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <ShieldCheck className="w-3 h-3" />
        Active ({ws.daysRemaining}d left)
      </span>
    );
  };

  const getReturnBadge = (returnInfo) => {
    const rs = calculateReturnStatus(returnInfo);
    if (rs.status === 'NOT_ELIGIBLE') return null;

    if (rs.status === 'UNKNOWN') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          <RotateCcw className="w-3 h-3" />
          Return Eligible
        </span>
      );
    }

    if (rs.status === 'RETURN_EXPIRED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400">
          <RotateCcw className="w-3 h-3" />
          Return Closed
        </span>
      );
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
        rs.isExpiringSoon
          ? (rs.isCritical ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20')
          : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
      }`}>
        <RotateCcw className="w-3 h-3" />
        {rs.label}
      </span>
    );
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory('All');
    setWarrantyFilter('all');
    setReturnFilter('all');
    setLifecycleFilter('all');
    setSortBy('newest');
  };

  const isFiltered =
    search.trim() !== '' ||
    selectedCategory !== 'All' ||
    warrantyFilter !== 'all' ||
    returnFilter !== 'all' ||
    lifecycleFilter !== 'all';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            My Products Catalog
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Your centralized ownership ledger with active warranty, lifecycle stage and return tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchProducts}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <Link to="/add-purchase">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by product name, brand, model, serial #, or seller..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={lifecycleFilter}
              onChange={(e) => setLifecycleFilter(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 px-3 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="all">Lifecycle: All Stages</option>
              <option value="WARRANTY_ACTIVE">Warranty Active</option>
              <option value="RETURN_PERIOD">Return Period</option>
              <option value="Transfer Pending">Transfer Pending</option>
              <option value="WARRANTY_EXPIRED">Warranty Expired</option>
              <option value="Sold">Sold / Transferred</option>
              <option value="Disposed">Disposed</option>
            </select>

            <select
              value={warrantyFilter}
              onChange={(e) => setWarrantyFilter(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 px-3 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="all">Warranty: All</option>
              <option value="active">Warranty: Active</option>
              <option value="expiring">Warranty: Expiring Soon</option>
              <option value="expired">Warranty: Expired</option>
              <option value="none">No Warranty</option>
            </select>

            <select
              value={returnFilter}
              onChange={(e) => setReturnFilter(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 px-3 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="all">Return: All</option>
              <option value="eligible">Return: Eligible</option>
              <option value="expired">Return: Closed</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 px-3 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="newest">Sort: Recently Added</option>
              <option value="oldest">Sort: Oldest Added</option>
              <option value="purchase-recent">Sort: Purchase Date (Recent)</option>
              <option value="price-high">Sort: Price (High to Low)</option>
              <option value="price-low">Sort: Price (Low to High)</option>
            </select>
          </div>
        </div>

        {/* Category Horizontal Scroll Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm shadow-sky-500/20'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
          {isFiltered && (
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors whitespace-nowrap"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Product Grid / States */}
      {loading ? (
        <LoadingSpinner label="Loading product catalog..." size="lg" />
      ) : products.length === 0 ? (
        isFiltered ? (
          <div className="p-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
            <Package className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-200">
              No matching products found
            </h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Try adjusting your search criteria or clearing active filters.
            </p>
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Clear All Filters
            </Button>
          </div>
        ) : (
          <EmptyState
            icon={Package}
            title="Your Product Catalog is Empty"
            description="You haven't cataloged any physical purchases yet. Register your first item to begin tracking warranties, return deadlines, and serial numbers with strict user isolation."
            badgeText="Catalog Empty"
            actionLabel="Add First Product"
            actionIcon={<Plus className="w-4 h-4" />}
            onAction={() => navigate('/add-purchase')}
            upcomingFeatures={[
              'Hardware serial number and model cataloging',
              'Proactive warranty expiration alerts and countdowns',
              'Store return window deadline reminders',
              'Future receipt document attachment & AI OCR',
            ]}
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((item) => (
            <div
              key={item._id}
              className="flex flex-col justify-between p-5 rounded-xl border border-slate-800/90 bg-slate-900/60 hover:bg-slate-900/90 hover:border-sky-500/30 transition-all duration-200 glow-card group"
            >
              <div>
                {/* Header: Category & Status */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 border border-slate-700">
                    {item.category}
                  </span>
                  <span
                    className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                      item.status === 'Active'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : item.status === 'In Repair'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : item.status === 'Transfer Pending'
                        ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                        : item.status === 'Transferred'
                        ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                {/* Title & Brand */}
                <Link
                  to={`/products/${item._id}`}
                  className="block group-hover:text-sky-400 transition-colors"
                >
                  <h3 className="text-base font-semibold text-slate-100 line-clamp-1">
                    {item.productName}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {item.brand ? item.brand : 'Unspecified Brand'}
                    {item.model && ` • ${item.model}`}
                  </p>
                </Link>

                {/* Serial Number Tag if present */}
                {item.serialNumber && (
                  <div className="mt-2.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-[10px] text-slate-400">
                    <span>S/N:</span>
                    <span className="text-slate-300 select-all">{item.serialNumber}</span>
                  </div>
                )}

                {/* Price & Purchase Date */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-medium">Price</span>
                    <span className="font-semibold text-slate-100 text-sm">
                      {formatCurrency(item.purchasePrice, item.currency)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px] uppercase font-medium">Purchased</span>
                    <span className="text-slate-300">
                      {formatDate(item.purchaseDate)}
                    </span>
                  </div>
                </div>

                {/* Badges for Warranty & Return */}
                <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/60">
                  {getWarrantyBadge(item.warranty)}
                  {getReturnBadge(item.returnInfo)}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <Link
                  to={`/products/${item._id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors"
                >
                  <span>Details</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>

                <button
                  onClick={() => setDeleteModalId(item._id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors"
                  title="Delete Product"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-100">
                Confirm Deletion
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to remove this product from your ownership ledger? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteModalId(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={isDeleting}
                onClick={() => handleDelete(deleteModalId)}
              >
                Delete Product
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;
