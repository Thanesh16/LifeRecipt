import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Wrench,
  ShieldCheck,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  ExternalLink,
  Phone,
  Calendar,
  IndianRupee,
  FileCheck,
  AlertTriangle,
  ChevronRight,
  Filter,
  X,
  Building2,
} from 'lucide-react';
import serviceRecordService from '../services/serviceRecordService';
import productService from '../services/productService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function ServicesPage() {
  const [activeTab, setActiveTab] = useState('records'); // 'records' | 'claims' | 'centers'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Data
  const [serviceRecords, setServiceRecords] = useState([]);
  const [claims, setClaims] = useState([]);
  const [serviceStats, setServiceStats] = useState(null);
  const [serviceAnalysis, setServiceAnalysis] = useState(null);
  const [products, setProducts] = useState([]);
  const [serviceCenters, setServiceCenters] = useState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [centerBrand, setCenterBrand] = useState('ALL');
  const [centerCity, setCenterCity] = useState('ALL');

  // Modals
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [selectedClaimProduct, setSelectedClaimProduct] = useState('');
  const [claimPreparation, setClaimPreparation] = useState(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Service Record Form State
  const [serviceForm, setServiceForm] = useState({
    productId: '',
    serviceType: 'REPAIR',
    status: 'REQUESTED',
    serviceProvider: '',
    serviceCenterName: '',
    serviceCenterAddress: '',
    serviceCenterPhone: '',
    issueTitle: '',
    issueDescription: '',
    reportedDate: new Date().toISOString().split('T')[0],
    scheduledDate: '',
    completedDate: '',
    estimatedCost: '',
    actualCost: '',
    notes: '',
  });

  // Claim Form State
  const [claimForm, setClaimForm] = useState({
    productId: '',
    issueTitle: '',
    issueDescription: '',
    serviceProvider: '',
    serviceCenterName: '',
    serviceCenterAddress: '',
    serviceCenterPhone: '',
    notes: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [recRes, claimRes, statRes, prodRes, centerRes, analysisRes] = await Promise.all([
        serviceRecordService.getServiceRecords(),
        serviceRecordService.getWarrantyClaims(),
        serviceRecordService.getServiceStats(),
        productService.getProducts(),
        serviceRecordService.getServiceCenters(),
        serviceRecordService.getServiceHistoryAnalysis().catch(() => ({ data: null })),
      ]);

      setServiceRecords(recRes.data?.records || []);
      setClaims(claimRes.data || []);
      setServiceStats(statRes.data || null);
      setProducts(prodRes.data?.products || prodRes.data || []);
      setServiceCenters(centerRes.data || []);
      setServiceAnalysis(analysisRes?.data || null);
    } catch (err) {
      console.error('Failed to load service ecosystem data:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load services data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // When claim product changes in Claim Modal, load readiness checklist
  const handleClaimProductChange = async (prodId) => {
    setSelectedClaimProduct(prodId);
    setClaimForm((prev) => ({ ...prev, productId: prodId }));
    if (!prodId) {
      setClaimPreparation(null);
      return;
    }

    try {
      setPrepLoading(true);
      const res = await serviceRecordService.prepareWarrantyClaim(prodId);
      setClaimPreparation(res.data);
      if (res.data?.product?.brand) {
        setClaimForm((prev) => ({
          ...prev,
          serviceProvider: `${res.data.product.brand} Authorized Service`,
        }));
      }
    } catch (err) {
      console.error('Failed to prepare warranty claim checklist:', err);
    } finally {
      setPrepLoading(false);
    }
  };

  const handleCreateService = async (e) => {
    e.preventDefault();
    if (!serviceForm.productId || !serviceForm.issueTitle) {
      alert('Please select a product and provide an issue title.');
      return;
    }

    try {
      setSubmitting(true);
      await serviceRecordService.createServiceRecord({
        ...serviceForm,
        estimatedCost: serviceForm.estimatedCost ? Number(serviceForm.estimatedCost) : 0,
        actualCost: serviceForm.actualCost ? Number(serviceForm.actualCost) : 0,
      });
      setShowAddServiceModal(false);
      setActionSuccess('Service record logged successfully!');
      setTimeout(() => setActionSuccess(null), 4000);
      setServiceForm({
        productId: '',
        serviceType: 'REPAIR',
        status: 'REQUESTED',
        serviceProvider: '',
        serviceCenterName: '',
        serviceCenterAddress: '',
        serviceCenterPhone: '',
        issueTitle: '',
        issueDescription: '',
        reportedDate: new Date().toISOString().split('T')[0],
        scheduledDate: '',
        completedDate: '',
        estimatedCost: '',
        actualCost: '',
        notes: '',
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to create service record');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitClaim = async (e) => {
    e.preventDefault();
    if (!claimForm.productId || !claimForm.issueTitle) {
      alert('Please select a product and state the issue.');
      return;
    }

    try {
      setSubmitting(true);
      await serviceRecordService.submitWarrantyClaim(claimForm);
      setShowClaimModal(false);
      setActionSuccess('Warranty claim successfully submitted and linked to service ledger!');
      setTimeout(() => setActionSuccess(null), 4000);
      setClaimForm({
        productId: '',
        issueTitle: '',
        issueDescription: '',
        serviceProvider: '',
        serviceCenterName: '',
        serviceCenterAddress: '',
        serviceCenterPhone: '',
        notes: '',
      });
      setClaimPreparation(null);
      setSelectedClaimProduct('');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to submit warranty claim');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered records
  const filteredRecords = serviceRecords.filter((rec) => {
    const matchesSearch =
      !searchQuery ||
      rec.issueTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.productId?.productName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.serviceProvider?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.serviceCenterName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || rec.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered centers
  const filteredCenters = serviceCenters.filter((c) => {
    const matchesBrand = centerBrand === 'ALL' || c.brand.toLowerCase() === centerBrand.toLowerCase();
    const matchesCity = centerCity === 'ALL' || c.city.toLowerCase() === centerCity.toLowerCase();
    return matchesBrand && matchesCity;
  });

  const uniqueBrands = ['ALL', ...new Set(serviceCenters.map((c) => c.brand))];
  const uniqueCities = ['ALL', ...new Set(serviceCenters.map((c) => c.city))];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-7 h-7 text-primary-600 dark:text-primary-400" />
            Warranty & Service Ecosystem
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track repairs, maintenance appointments, verified service centers, and streamable warranty claims.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => setShowClaimModal(true)}
            className="flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            File Warranty Claim
          </Button>
          <Button
            variant="primary"
            onClick={() => setShowAddServiceModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Log Service Record
          </Button>
        </div>
      </div>

      {/* Success Banner */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-3 text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{actionSuccess}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Services</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {serviceStats?.totalRecords ?? serviceRecords.length}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Logged repairs & maintenance</p>
          </div>
          <div className="w-11 h-11 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Wrench className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">In Progress / Pending</p>
            <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {(serviceStats?.byStatus?.REQUESTED || 0) +
                (serviceStats?.byStatus?.SCHEDULED || 0) +
                (serviceStats?.byStatus?.IN_SERVICE || 0) +
                (serviceStats?.byStatus?.WAITING_FOR_PARTS || 0)}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Active service visits</p>
          </div>
          <div className="w-11 h-11 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Service Spend</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {formatCurrency(serviceStats?.totalCost || 0)}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Synchronized with expenses</p>
          </div>
          <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <IndianRupee className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Warranty Claims</p>
            <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
              {claims.length}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Formal claims tracked</p>
          </div>
          <div className="w-11 h-11 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Automated Service Pattern Analysis Banner (Phase 17) */}
      {serviceAnalysis?.patterns?.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Automated Service Pattern Detection ({serviceAnalysis.patterns.length} Advisory Alerts)</span>
            </div>
            {serviceAnalysis.averageTurnaroundDays !== null && (
              <span className="text-xs text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-full border border-slate-800">
                Avg. Turnaround: <strong className="text-white">{serviceAnalysis.averageTurnaroundDays} days</strong>
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {serviceAnalysis.patterns.map((pat, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{pat.productName}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    pat.severity === 'HIGH' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {pat.type.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-slate-300">{pat.message}</p>
                {pat.recommendation && (
                  <p className="text-sky-400 text-[11px] font-medium pt-0.5">💡 {pat.recommendation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-800 flex gap-6">
        <button
          onClick={() => setActiveTab('records')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'records'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Wrench className="w-4 h-4" />
          Service Records ({serviceRecords.length})
        </button>

        <button
          onClick={() => setActiveTab('claims')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'claims'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Warranty Claims ({claims.length})
        </button>

        <button
          onClick={() => setActiveTab('centers')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'centers'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Authorized Centers ({filteredCenters.length})
        </button>
      </div>

      {/* TAB 1: SERVICE RECORDS */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          {/* Search & Status Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search issue, product, or center..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="REQUESTED">Requested</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="IN_SERVICE">In Service</option>
                <option value="WAITING_FOR_PARTS">Waiting for Parts</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="No Service Records Found"
              description="Keep your hardware running smoothly by logging routine maintenance, inspections, and repairs."
              action={
                <Button onClick={() => setShowAddServiceModal(true)}>
                  Log First Service Record
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredRecords.map((rec) => (
                <Card key={rec._id} className="p-5 hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {rec.serviceType.replace('_', ' ')}
                        </span>

                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                            rec.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : rec.status === 'IN_SERVICE' || rec.status === 'SCHEDULED'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          }`}
                        >
                          {rec.status.replace('_', ' ')}
                        </span>

                        {rec.warrantyRelated && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                            Covered Under Warranty
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-bold text-gray-900 dark:text-white">
                        {rec.issueTitle}
                      </h4>

                      {rec.productId && (
                        <p className="text-sm font-medium text-primary-600 dark:text-primary-400 flex items-center gap-1">
                          <Link to={`/products/${rec.productId._id}`} className="hover:underline">
                            {rec.productId.productName} ({rec.productId.brand || 'Item'})
                          </Link>
                        </p>
                      )}

                      {rec.issueDescription && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                          {rec.issueDescription}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-1 flex-wrap">
                        {(rec.serviceCenterName || rec.serviceProvider) && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            {rec.serviceCenterName || rec.serviceProvider}
                          </span>
                        )}
                        {rec.serviceCenterPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {rec.serviceCenterPhone}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Reported: {formatDate(rec.reportedDate)}
                        </span>
                        {rec.completedDate && (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Resolved: {formatDate(rec.completedDate)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex md:flex-col items-end justify-between md:justify-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-gray-100 dark:border-gray-800">
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Actual Cost</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {rec.actualCost > 0
                            ? formatCurrency(rec.actualCost)
                            : rec.status === 'COMPLETED'
                            ? 'Free / In-Warranty'
                            : rec.estimatedCost > 0
                            ? `Est: ${formatCurrency(rec.estimatedCost)}`
                            : '—'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {rec.productId && (
                          <Link
                            to={`/products/${rec.productId._id}/passport`}
                            className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
                          >
                            Passport <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WARRANTY CLAIMS */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          <div className="p-4 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                Zero-Hallucination Warranty Claim Protocol
              </h4>
              <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                LifeReceipt verifies purchase invoice integrity, serial numbers, and coverage windows before submission to ensure manufacturer acceptance.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowClaimModal(true)}
              className="flex-shrink-0"
            >
              Prepare New Claim
            </Button>
          </div>

          {claims.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No Warranty Claims Filed"
              description="Need repair or replacement under warranty? Prepare a claim to verify proof of purchase and generate a submission package."
              action={
                <Button onClick={() => setShowClaimModal(true)}>
                  Prepare Warranty Claim
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {claims.map((claim) => (
                <Card key={claim._id} className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-700 dark:text-gray-300">
                          {claim.claimReference}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                            claim.status === 'APPROVED' || claim.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : claim.status === 'SUBMITTED' || claim.status === 'UNDER_REVIEW'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          {claim.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs font-medium text-gray-500">
                          Readiness: {claim.readinessScore || 100}%
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-gray-900 dark:text-white">
                        {claim.issueTitle}
                      </h4>

                      {claim.productId && (
                        <p className="text-sm text-primary-600 dark:text-primary-400">
                          <Link to={`/products/${claim.productId._id}`}>
                            {claim.productId.productName} • S/N: {claim.productId.serialNumber || 'Recorded'}
                          </Link>
                        </p>
                      )}

                      {claim.issueDescription && (
                        <p className="text-xs text-gray-600 dark:text-gray-300">
                          {claim.issueDescription}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-500 pt-1">
                        <span>Submitted: {formatDate(claim.createdAt)}</span>
                        {claim.provider && <span>Provider: {claim.provider}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {claim.productId && (
                        <Link to={`/products/${claim.productId._id}/passport`}>
                          <Button variant="secondary" size="sm">
                            View Passport
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AUTHORIZED SERVICE CENTERS */}
      {activeTab === 'centers' && (
        <div className="space-y-4">
          {/* Directory Filter bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Manufacturer Brand</label>
                <select
                  value={centerBrand}
                  onChange={(e) => setCenterBrand(e.target.value)}
                  className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {uniqueBrands.map((b) => (
                    <option key={b} value={b}>
                      {b === 'ALL' ? 'All Brands' : b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">City / Region</label>
                <select
                  value={centerCity}
                  onChange={(e) => setCenterCity(e.target.value)}
                  className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {uniqueCities.map((c) => (
                    <option key={c} value={c}>
                      {c === 'ALL' ? 'All Cities' : c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-xs text-gray-500 self-end">
              Showing {filteredCenters.length} verified manufacturer service facilities
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCenters.map((center) => (
              <Card key={center.id} className="p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                      {center.brand}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {center.authorizationType}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-gray-900 dark:text-white">
                    {center.name}
                  </h4>

                  <p className="text-xs text-gray-600 dark:text-gray-300 flex items-start gap-1.5">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span>{center.address}, {center.city}, {center.state} - {center.postalCode}</span>
                  </p>

                  <p className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span>{center.operatingHours}</span>
                  </p>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {center.supportedServices.map((svc) => (
                      <span
                        key={svc}
                        className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                      >
                        {svc}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                  <a
                    href={`tel:${center.phone}`}
                    className="text-xs font-semibold text-primary-600 dark:text-primary-400 flex items-center gap-1.5 hover:underline"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {center.phone}
                  </a>

                  {center.officialWebsite && (
                    <a
                      href={center.officialWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
                    >
                      Official Portal <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: LOG SERVICE RECORD */}
      {showAddServiceModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary-600" />
                Log Service or Repair Record
              </h3>
              <button
                onClick={() => setShowAddServiceModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateService} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Select Product *
                </label>
                <select
                  required
                  value={serviceForm.productId}
                  onChange={(e) => setServiceForm({ ...serviceForm, productId: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">-- Choose Registered Product --</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.productName} ({p.brand || 'Item'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    Service Type
                  </label>
                  <select
                    value={serviceForm.serviceType}
                    onChange={(e) => setServiceForm({ ...serviceForm, serviceType: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                  >
                    <option value="REPAIR">Repair</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="WARRANTY_CLAIM">Warranty Claim</option>
                    <option value="INSPECTION">Inspection</option>
                    <option value="INSTALLATION">Installation</option>
                    <option value="REPLACEMENT">Replacement</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    Status
                  </label>
                  <select
                    value={serviceForm.status}
                    onChange={(e) => setServiceForm({ ...serviceForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                  >
                    <option value="REQUESTED">Requested</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="IN_SERVICE">In Service</option>
                    <option value="WAITING_FOR_PARTS">Waiting for Parts</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Issue / Service Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Battery replacement, annual thermal cleaning"
                  value={serviceForm.issueTitle}
                  onChange={(e) => setServiceForm({ ...serviceForm, issueTitle: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Issue Details
                </label>
                <textarea
                  rows={2}
                  placeholder="Symptoms observed, technician diagnoses, replaced parts..."
                  value={serviceForm.issueDescription}
                  onChange={(e) => setServiceForm({ ...serviceForm, issueDescription: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    Service Center Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HP Authorised Care Center"
                    value={serviceForm.serviceCenterName}
                    onChange={(e) => setServiceForm({ ...serviceForm, serviceCenterName: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    Phone / Helpline
                  </label>
                  <input
                    type="text"
                    placeholder="1800-xxx-xxxx"
                    value={serviceForm.serviceCenterPhone}
                    onChange={(e) => setServiceForm({ ...serviceForm, serviceCenterPhone: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    Reported Date
                  </label>
                  <input
                    type="date"
                    value={serviceForm.reportedDate}
                    onChange={(e) => setServiceForm({ ...serviceForm, reportedDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    value={serviceForm.scheduledDate}
                    onChange={(e) => setServiceForm({ ...serviceForm, scheduledDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    Completed Date
                  </label>
                  <input
                    type="date"
                    value={serviceForm.completedDate}
                    onChange={(e) => setServiceForm({ ...serviceForm, completedDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    Estimated Cost (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={serviceForm.estimatedCost}
                    onChange={(e) => setServiceForm({ ...serviceForm, estimatedCost: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    Actual Cost (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={serviceForm.actualCost}
                    onChange={(e) => setServiceForm({ ...serviceForm, actualCost: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                💡 Entering an Actual Cost for a Completed service will automatically record a linked expense in your Ownership Cost Ledger with zero duplication.
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t dark:border-gray-800">
                <Button variant="secondary" type="button" onClick={() => setShowAddServiceModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Service Record'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: FILE WARRANTY CLAIM */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                Warranty Claim Preparation & Submission
              </h3>
              <button onClick={() => setShowClaimModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitClaim} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Product Under Warranty *
                </label>
                <select
                  required
                  value={selectedClaimProduct}
                  onChange={(e) => handleClaimProductChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">-- Choose Product to Claim Warranty --</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.productName} ({p.brand || 'Item'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Real-time Checklist Inspection */}
              {prepLoading && (
                <div className="py-4 flex justify-center">
                  <LoadingSpinner size="sm" />
                </div>
              )}

              {claimPreparation && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg space-y-3 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Readiness Checklist Score
                    </span>
                    <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                      {claimPreparation.readinessScore}%
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {claimPreparation.checklist.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                          {item.status === 'PASS' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          {item.label}
                        </span>
                        <span
                          className={`font-semibold ${
                            item.status === 'PASS' ? 'text-emerald-600' : 'text-amber-600'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>

                  {claimPreparation.missingItems?.length > 0 && (
                    <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                      <p className="font-semibold mb-1">Recommended before filing:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {claimPreparation.missingItems.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Defect / Issue Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Display backlight failure, motherboard not charging"
                  value={claimForm.issueTitle}
                  onChange={(e) => setClaimForm({ ...claimForm, issueTitle: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Detailed Issue Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide details of when the defect started, steps taken to reproduce, and any error codes."
                  value={claimForm.issueDescription}
                  onChange={(e) => setClaimForm({ ...claimForm, issueDescription: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    Warranty Provider / Brand
                  </label>
                  <input
                    type="text"
                    value={claimForm.serviceProvider}
                    onChange={(e) => setClaimForm({ ...claimForm, serviceProvider: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    Target Service Center
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Authorized Brand Service Partner"
                    value={claimForm.serviceCenterName}
                    onChange={(e) => setClaimForm({ ...claimForm, serviceCenterName: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t dark:border-gray-800">
                <Button variant="secondary" type="button" onClick={() => setShowClaimModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={submitting || !selectedClaimProduct}>
                  {submitting ? 'Submitting...' : 'Submit Warranty Claim'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
