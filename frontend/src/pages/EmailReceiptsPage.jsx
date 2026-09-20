import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Mail,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Clock,
  Sparkles,
  Search,
  ArrowRight,
  ExternalLink,
  Shield,
  Tag,
  Plus,
  X,
  Link2,
} from 'lucide-react';
import emailReceiptService from '../services/emailReceiptService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatCurrency, formatDate } from '../utils/formatters';

export const EmailReceiptsPage = () => {
  const location = useLocation();
  const [candidates, setCandidates] = useState([]);
  const [counts, setCounts] = useState({ all: 0, needsReview: 0, confirmed: 0, rejected: 0, duplicates: 0, failed: 0 });
  const [connections, setConnections] = useState([]);
  const [activeTab, setActiveTab] = useState('needs_review');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const status = searchParams.get('status');
    const email = searchParams.get('email');
    const message = searchParams.get('message');

    if (status === 'success') {
      setNotification(`Gmail connected successfully: ${email || 'your account'}`);
      fetchConnections();
      setTimeout(() => setNotification(''), 5000);
    } else if (status === 'error') {
      setError(message || 'Failed to complete Google authentication');
    } else if (location.state?.message) {
      setNotification(location.state.message);
      setTimeout(() => setNotification(''), 5000);
    }
  }, [location]);

  // Review Modal State
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState({});
  const [linkToExisting, setLinkToExisting] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const fetchConnections = async () => {
    try {
      const res = await emailReceiptService.getConnectedAccounts();
      if (res.success && res.data) {
        setConnections(res.data);
      }
    } catch (err) {
      console.warn('[Connections Fetch Error]', err);
    }
  };

  const fetchCandidates = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await emailReceiptService.getCandidates({ tab: activeTab });
      if (res.success && res.data) {
        setCandidates(res.data.candidates || []);
        if (res.data.counts) {
          setCounts(res.data.counts);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load email receipts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  useEffect(() => {
    fetchCandidates();
  }, [activeTab]);

  const handleConnectGmail = async () => {
    setConnecting(true);
    setError('');
    try {
      const redirectUri = `${window.location.origin}/oauth/google/callback`;
      const authData = await emailReceiptService.getGoogleAuthUrl(redirectUri);
      const authUrl = authData.authUrl || authData.data?.authUrl;
      const isConfigured = authData.configured || authData.data?.configured;

      if (isConfigured && authUrl) {
        window.location.href = authUrl;
        return;
      } else {
        setError(authData.message || 'Gmail OAuth configuration required. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to initiate Google OAuth');
    } finally {
      setConnecting(false);
    }
  };

  const handleManualSync = async () => {
    if (connections.length === 0) return;
    setSyncing(true);
    setError('');
    try {
      const activeConn = connections.find((c) => c.status === 'CONNECTED') || connections[0];
      const res = await emailReceiptService.syncAccount(activeConn._id);
      setNotification(`Sync completed! ${res.data?.newCandidatesCount || 0} new receipt candidate(s) discovered.`);
      setTimeout(() => setNotification(''), 4000);
      await fetchCandidates();
      await fetchConnections();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to sync email account');
    } finally {
      setSyncing(false);
    }
  };

  const openReviewModal = (candidate) => {
    setSelectedCandidate(candidate);
    const p = candidate.extractedProduct || {};
    setReviewForm({
      productName: p.productName || '',
      category: p.category || 'Electronics',
      brand: p.brand || '',
      model: p.model || '',
      serialNumber: p.serialNumber || '',
      purchasePrice: p.purchasePrice || 0,
      purchaseDate: p.purchaseDate ? p.purchaseDate.split('T')[0] : '',
      sellerName: p.sellerName || '',
      invoiceNumber: p.invoiceNumber || '',
      taxInfo: p.taxInfo || '',
      warrantyMonths: p.warranty?.durationMonths || 12,
      warrantyProvider: p.warranty?.warrantyProvider || '',
    });
    setLinkToExisting(candidate.duplicateStatus === 'POSSIBLE_DUPLICATE' && Boolean(candidate.existingMatch?.productId));
    setIsReviewModalOpen(true);
  };

  const handleConfirmCandidate = async (e) => {
    e.preventDefault();
    if (!selectedCandidate) return;
    setReviewSubmitting(true);
    try {
      const payload = {
        modifiedFields: {
          productName: reviewForm.productName,
          category: reviewForm.category,
          brand: reviewForm.brand,
          model: reviewForm.model,
          serialNumber: reviewForm.serialNumber,
          purchasePrice: Number(reviewForm.purchasePrice) || 0,
          purchaseDate: reviewForm.purchaseDate,
          sellerName: reviewForm.sellerName,
          invoiceNumber: reviewForm.invoiceNumber,
          taxInfo: reviewForm.taxInfo,
          warranty: {
            hasWarranty: Boolean(reviewForm.warrantyMonths > 0),
            durationMonths: Number(reviewForm.warrantyMonths) || null,
            warrantyProvider: reviewForm.warrantyProvider,
          },
        },
        linkToExistingProductId: linkToExisting ? selectedCandidate.existingMatch?.productId : null,
      };

      await emailReceiptService.confirmCandidate(selectedCandidate._id, payload);
      setNotification('Purchase verified and successfully added to your ownership ledger!');
      setTimeout(() => setNotification(''), 4000);
      setIsReviewModalOpen(false);
      await fetchCandidates();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to confirm receipt candidate');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleRejectCandidate = async (candidateId) => {
    try {
      await emailReceiptService.rejectCandidate(candidateId, 'Declined by user');
      setNotification('Receipt candidate marked as rejected.');
      setTimeout(() => setNotification(''), 3000);
      await fetchCandidates();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject candidate');
    }
  };

  const tabs = [
    { key: 'needs_review', label: 'Needs Review', count: counts.needsReview },
    { key: 'all', label: 'All Candidates', count: counts.all },
    { key: 'confirmed', label: 'Confirmed', count: counts.confirmed },
    { key: 'duplicates', label: 'Duplicates', count: counts.duplicates },
    { key: 'rejected', label: 'Rejected', count: counts.rejected },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Email Receipt Intelligence
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
              Phase 11
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Automated purchase discovery from authorized email accounts with Indian GST parsing & duplicate protection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {connections.length > 0 && connections[0].status === 'CONNECTED' ? (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />}
              onClick={handleManualSync}
              disabled={syncing}
            >
              {syncing ? 'Scanning Mailbox...' : 'Sync Mailbox Now'}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Mail className="w-4 h-4" />}
              onClick={handleConnectGmail}
              disabled={connecting}
            >
              {connecting ? 'Connecting...' : 'Connect Gmail'}
            </Button>
          )}
        </div>
      </div>

      {/* Notifications / Alerts */}
      {notification && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Connection Status Banner */}
      {connections.length > 0 && connections[0].status === 'CONNECTED' ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <span className="font-semibold text-slate-100">
                {connections[0].provider === 'GMAIL' ? 'Gmail Connected' : `${connections[0].provider} Connected`}: {connections[0].emailAddress}
              </span>
              <span className="text-slate-400 block sm:inline sm:ml-2">
                • Last synced: {connections[0].lastSyncedAt ? formatDate(connections[0].lastSyncedAt) : 'Never'}
              </span>
            </div>
          </div>
          <Link
            to="/settings"
            className="text-sky-400 hover:text-sky-300 font-semibold text-[11px] flex items-center gap-1"
          >
            Manage Accounts <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-sky-950/40 via-slate-900 to-slate-950 border border-sky-500/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                Gmail Not Connected
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 mt-1">
              <Mail className="w-4 h-4 text-sky-400" />
              Connect your Gmail to discover purchases automatically
            </h4>
            <p className="text-xs text-slate-400 max-w-2xl">
              LifeReceipt searches exclusively for purchase confirmations, GST tax invoices, and retail bills using read-only permissions (gmail.readonly). Your emails are never scanned silently or shared.
            </p>
          </div>
          <div className="shrink-0">
            <Button size="sm" variant="primary" onClick={handleConnectGmail} disabled={connecting}>
              {connecting ? 'Connecting...' : 'Connect Gmail'}
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === tab.key
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === tab.key ? 'bg-primary-800 text-white' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content Stream */}
      {loading ? (
        <div className="py-16 flex items-center justify-center">
          <LoadingSpinner label="Fetching discovered email receipts..." />
        </div>
      ) : candidates.length === 0 ? (
        <Card className="text-center py-12">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">No purchase-related emails found</h3>
            <p className="text-xs text-slate-400">
              {activeTab === 'needs_review'
                ? 'No new purchase receipts or tax invoices were discovered in your inbox.'
                : 'No purchase records match the current filter.'}
            </p>
            {connections.length > 0 && connections[0].status === 'CONNECTED' ? (
              <Button size="sm" variant="outline" onClick={handleManualSync} disabled={syncing}>
                {syncing ? 'Scanning Mailbox...' : 'Sync Mailbox Now'}
              </Button>
            ) : (
              <Button size="sm" variant="primary" onClick={handleConnectGmail} disabled={connecting}>
                {connecting ? 'Connecting...' : 'Connect Gmail'}
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {candidates.map((c) => {
            const p = c.extractedProduct || {};
            const isDuplicate = c.duplicateStatus === 'EXACT_DUPLICATE' || c.duplicateStatus === 'POSSIBLE_DUPLICATE';
            const isConfirmed = c.extractionStatus === 'CONFIRMED';
            const isRejected = c.extractionStatus === 'REJECTED';

            return (
              <div
                key={c._id}
                className={`rounded-2xl border p-4 transition-colors ${
                  isConfirmed
                    ? 'bg-slate-900/40 border-slate-800 opacity-90'
                    : isRejected
                    ? 'bg-slate-900/30 border-slate-800/60 opacity-60'
                    : isDuplicate
                    ? 'bg-slate-900/90 border-amber-500/30'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {c.provider}
                      </span>

                      {/* Confidence Badge */}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          c.confidence === 'HIGH'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : c.confidence === 'MEDIUM'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {c.confidence} Confidence ({c.confidenceScore || 50}%)
                      </span>

                      {/* Status Badge */}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          isConfirmed
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : isRejected
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : c.extractionStatus === 'DUPLICATE'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                        }`}
                      >
                        {c.extractionStatus.replace('_', ' ')}
                      </span>

                      {/* Duplicate Flag */}
                      {isDuplicate && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {c.duplicateStatus === 'EXACT_DUPLICATE' ? 'Exact Duplicate' : 'Possible Existing Asset'}
                        </span>
                      )}

                      {/* Source Conflict Flag */}
                      {c.sourceConflict?.hasConflict && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          Source Conflict
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-100 truncate">
                        {p.productName || c.subject}
                      </h4>
                      {p.purchasePrice > 0 && (
                        <span className="text-sm font-extrabold text-emerald-400">
                          {formatCurrency(p.purchasePrice, 'INR')}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 truncate">
                      From: <span className="text-slate-300">{c.sender}</span> • {c.subject}
                    </p>

                    {/* Duplicate reason alert */}
                    {isDuplicate && c.duplicateReason && (
                      <p className="text-[11px] text-amber-300/90 italic bg-amber-500/5 px-2 py-1 rounded border border-amber-500/20">
                        {c.duplicateReason}
                      </p>
                    )}

                    {/* Source Conflict Alert */}
                    {c.sourceConflict?.hasConflict && (
                      <p className="text-[11px] text-rose-300/90 bg-rose-500/10 px-2.5 py-1.5 rounded-lg border border-rose-500/25">
                        <strong className="text-rose-200">Source Conflict: </strong>
                        {c.sourceConflict.conflictReason || `Email indicates '${c.sourceConflict.emailIndicates}' but attached document indicates '${c.sourceConflict.attachmentIndicates}'.`}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                      <span>Received: {formatDate(c.receivedAt)}</span>
                      {p.sellerName && <span>Seller: {p.sellerName}</span>}
                      {p.invoiceNumber && <span>Invoice: {p.invoiceNumber}</span>}
                      {c.attachmentMetadata?.length > 0 && (
                        <span className="text-sky-400 flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {c.attachmentMetadata[0].fileName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
                    {!isConfirmed && !isRejected ? (
                      <>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => openReviewModal(c)}
                        >
                          Review Purchase
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectCandidate(c._id)}
                        >
                          Reject
                        </Button>
                      </>
                    ) : isConfirmed ? (
                      <div className="flex items-center gap-2 text-xs text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirmed</span>
                        {c.linkedProductId && (
                          <Link
                            to={`/products/${c.linkedProductId._id || c.linkedProductId}`}
                            className="text-sky-400 hover:underline flex items-center gap-0.5 ml-2"
                          >
                            View Asset <ArrowRight className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Rejected</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Purchase Modal */}
      {isReviewModalOpen && selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary-500/10 border border-primary-500/20 rounded-xl text-primary-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Review Purchase Candidate</h3>
                  <p className="text-xs text-slate-400">
                    Source: {selectedCandidate.provider} • {selectedCandidate.sender}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Duplicate Notice */}
            {selectedCandidate.existingMatch?.productId && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl space-y-2 text-xs text-amber-300">
                <div className="flex items-center gap-2 font-semibold text-amber-200">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Existing Asset Match Detected</span>
                </div>
                <p>
                  Found matching asset: <strong>{selectedCandidate.existingMatch.productName}</strong>{' '}
                  {selectedCandidate.existingMatch.purchasePrice &&
                    `(${formatCurrency(selectedCandidate.existingMatch.purchasePrice, 'INR')})`}
                </p>
                <label className="flex items-center gap-2 text-slate-200 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={linkToExisting}
                    onChange={(e) => setLinkToExisting(e.target.checked)}
                    className="rounded border-slate-700 text-primary-600 focus:ring-primary-500"
                  />
                  <span>Link this receipt to the existing product instead of creating a duplicate</span>
                </label>
              </div>
            )}

            {/* Source Conflict Alert */}
            {selectedCandidate.sourceConflict?.hasConflict && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-xl space-y-2 text-xs text-rose-300">
                <div className="flex items-center gap-2 font-semibold text-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Source Conflict Detected</span>
                </div>
                <p>
                  {selectedCandidate.sourceConflict.conflictReason || 'Discrepancy detected between email details and attached document.'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block font-semibold mb-0.5">Email Indicates:</span>
                    <span className="text-slate-200">{selectedCandidate.sourceConflict.emailIndicates}</span>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block font-semibold mb-0.5">Attachment Indicates:</span>
                    <span className="text-slate-200">{selectedCandidate.sourceConflict.attachmentIndicates}</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 pt-0.5">
                  Please verify the fields below to confirm authentic product details.
                </p>
              </div>
            )}

            <form onSubmit={handleConfirmCandidate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Product Name <span className="text-rose-400">*</span>
                  </label>
                  <Input
                    value={reviewForm.productName}
                    onChange={(e) => setReviewForm({ ...reviewForm, productName: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={reviewForm.category}
                    onChange={(e) => setReviewForm({ ...reviewForm, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-primary-500"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Computing">Computing</option>
                    <option value="Appliances">Appliances</option>
                    <option value="Home & Furniture">Home & Furniture</option>
                    <option value="Personal & Apparel">Personal & Apparel</option>
                    <option value="Automotive">Automotive</option>
                    <option value="Tools & Hardware">Tools & Hardware</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Brand</label>
                  <Input
                    value={reviewForm.brand}
                    onChange={(e) => setReviewForm({ ...reviewForm, brand: e.target.value })}
                    placeholder="e.g. HP, Apple, Sony"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Model</label>
                  <Input
                    value={reviewForm.model}
                    onChange={(e) => setReviewForm({ ...reviewForm, model: e.target.value })}
                    placeholder="e.g. Pavilion 15-eg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Serial Number</label>
                  <Input
                    value={reviewForm.serialNumber}
                    onChange={(e) => setReviewForm({ ...reviewForm, serialNumber: e.target.value })}
                    placeholder="Hardware S/N if available"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Purchase Price (₹ INR) <span className="text-rose-400">*</span>
                  </label>
                  <Input
                    type="number"
                    value={reviewForm.purchasePrice}
                    onChange={(e) => setReviewForm({ ...reviewForm, purchasePrice: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Purchase Date <span className="text-rose-400">*</span>
                  </label>
                  <Input
                    type="date"
                    value={reviewForm.purchaseDate}
                    onChange={(e) => setReviewForm({ ...reviewForm, purchaseDate: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Seller / Merchant</label>
                  <Input
                    value={reviewForm.sellerName}
                    onChange={(e) => setReviewForm({ ...reviewForm, sellerName: e.target.value })}
                    placeholder="e.g. Amazon India / Croma"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Invoice Number</label>
                  <Input
                    value={reviewForm.invoiceNumber}
                    onChange={(e) => setReviewForm({ ...reviewForm, invoiceNumber: e.target.value })}
                    placeholder="e.g. INV-2026-99"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    GST / Tax Information
                  </label>
                  <Input
                    value={reviewForm.taxInfo}
                    onChange={(e) => setReviewForm({ ...reviewForm, taxInfo: e.target.value })}
                    placeholder="e.g. GSTIN: 29ABCDE1234F1Z5 | CGST: ₹5,567 | SGST: ₹5,567"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Warranty (Months)</label>
                  <Input
                    type="number"
                    value={reviewForm.warrantyMonths}
                    onChange={(e) => setReviewForm({ ...reviewForm, warrantyMonths: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Warranty Provider</label>
                  <Input
                    value={reviewForm.warrantyProvider}
                    onChange={(e) => setReviewForm({ ...reviewForm, warrantyProvider: e.target.value })}
                    placeholder="Manufacturer / Store"
                  />
                </div>
              </div>

              {/* Attachment summary */}
              {selectedCandidate.attachmentMetadata?.length > 0 && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                    <span className="truncate">{selectedCandidate.attachmentMetadata[0].fileName}</span>
                  </div>
                  <span className="text-slate-400 text-[11px] shrink-0">
                    Will be securely stored in Document Vault
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsReviewModalOpen(false)}
                  disabled={reviewSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={reviewSubmitting}
                >
                  {linkToExisting ? 'Link to Existing Asset' : 'Confirm & Add to Ledger'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailReceiptsPage;
