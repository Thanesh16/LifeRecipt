import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FileText,
  ShieldCheck,
  Download,
  Share2,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Clock,
  IndianRupee,
  Wrench,
  ChevronRight,
  Eye,
  Trash2,
  Copy,
  ExternalLink,
  ArrowLeft,
  X,
  Lock,
  Layers,
} from 'lucide-react';
import passportService from '../services/passportService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function PassportPage() {
  const { id, productId: routeProductId } = useParams();
  const productId = id || routeProductId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [passportData, setPassportData] = useState(null);
  const [shareTokens, setShareTokens] = useState([]);
  const [successMessage, setSuccessMessage] = useState(null);

  // Share Modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [permissionLevel, setPermissionLevel] = useState('STANDARD');
  const [expiresDays, setExpiresDays] = useState('30');
  const [generatedShare, setGeneratedShare] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchPassport = async () => {
    try {
      setLoading(true);
      setError(null);
      const [pRes, sRes] = await Promise.all([
        passportService.getPassport(productId),
        passportService.getShareTokens(productId),
      ]);
      setPassportData(pRes.data);
      setShareTokens(sRes.data || []);
    } catch (err) {
      console.error('Failed to load passport:', err);
      setError(err.response?.data?.message || err.message || 'Failed to generate passport');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (productId) {
      fetchPassport();
    }
  }, [productId]);

  const handleCreateShare = async (e) => {
    e.preventDefault();
    try {
      setSharing(true);
      const res = await passportService.createShareToken(productId, {
        permissionLevel,
        expiresDays: Number(expiresDays),
      });
      setGeneratedShare(res.data);
      setSuccessMessage('Share link generated successfully!');
      // Refresh shares list
      const sRes = await passportService.getShareTokens(productId);
      setShareTokens(sRes.data || []);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to generate share link');
    } finally {
      setSharing(false);
    }
  };

  const handleRevokeShare = async (shareId) => {
    if (!window.confirm('Are you sure you want to revoke this passport share link? Anyone holding this link will lose access immediately.')) {
      return;
    }

    try {
      await passportService.revokeShareToken(shareId);
      setSuccessMessage('Passport share link revoked.');
      setTimeout(() => setSuccessMessage(null), 3000);
      const sRes = await passportService.getShareTokens(productId);
      setShareTokens(sRes.data || []);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to revoke share link');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-sm text-gray-500">Synthesizing Digital Ownership Passport...</p>
      </div>
    );
  }

  if (error || !passportData) {
    return (
      <div className="py-12 space-y-4">
        <Link to="/products" className="text-sm text-primary-600 flex items-center gap-1 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Products
        </Link>
        <EmptyState
          icon={AlertTriangle}
          title="Passport Generation Failed"
          description={error || 'Unable to retrieve digital passport for this product.'}
          action={<Button onClick={fetchPassport}>Try Again</Button>}
        />
      </div>
    );
  }

  const { product, verification, warranty, financials, serviceHistory, documentsSummary, ownershipChain, intelligence } =
    passportData;

  const pdfDownloadUrl = passportService.getPassportPDFUrl(productId);

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* Back link & Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          to={`/products/${productId}`}
          className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {product.productName}
        </Link>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setGeneratedShare(null);
              setShowShareModal(true);
            }}
            className="flex items-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Share Passport
          </Button>

          <a href={pdfDownloadUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="primary" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Download Official PDF
            </Button>
          </a>
        </div>
      </div>

      {/* Success alert */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4" />
          {successMessage}
        </div>
      )}

      {/* SECTION 1: PASSPORT HEADER & VERIFICATION BADGE */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl shadow-xl space-y-6 border border-slate-700/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-400/30">
                Official Document
              </span>
              <span className="text-xs text-slate-400">
                Issued: {formatDate(new Date())}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Digital Ownership Passport
            </h1>
            <p className="text-sm text-slate-300">
              Tamper-evident certificate of authenticity, provenance, warranty, and service ledger.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-3.5 rounded-xl backdrop-blur-md">
            <ShieldCheck
              className={`w-10 h-10 ${
                verification.tier === 'VERIFIED'
                  ? 'text-emerald-400'
                  : verification.tier === 'STANDARD'
                  ? 'text-sky-400'
                  : 'text-amber-400'
              }`}
            />
            <div>
              <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Integrity Badge</p>
              <h3 className="text-base font-bold text-white">{verification.badgeTitle}</h3>
              <p className="text-xs text-emerald-400 font-semibold">{verification.tier} TIER</p>
            </div>
          </div>
        </div>

        {/* Completeness Score Bar */}
        <div className="space-y-2 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-300 uppercase tracking-wider">Passport Completeness Score</span>
            <span className="text-sky-400 text-sm font-bold">{verification.score}%</span>
          </div>
          <div className="w-full bg-slate-700/60 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                verification.score >= 85
                  ? 'bg-emerald-400'
                  : verification.score >= 60
                  ? 'bg-sky-400'
                  : 'bg-amber-400'
              }`}
              style={{ width: `${verification.score}%` }}
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: PRODUCT IDENTITY & SPECS */}
      <Card className="p-6 space-y-4">
        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary-600" />
          Product Identity & Hardware Details
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg">
            <p className="text-xs text-gray-400 font-medium">Product Name</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{product.productName}</p>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg">
            <p className="text-xs text-gray-400 font-medium">Brand & Model</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
              {product.brand} • {product.model}
            </p>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg">
            <p className="text-xs text-gray-400 font-medium">Category</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{product.category}</p>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg">
            <p className="text-xs text-gray-400 font-medium">Hardware Serial Number</p>
            <p className="text-sm font-mono font-bold text-primary-600 dark:text-primary-400 mt-0.5">
              {product.serialNumber || 'Not Recorded'}
            </p>
          </div>
        </div>
      </Card>

      {/* 2-COLUMN LAYOUT: PROVENANCE + FINANCIALS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SECTION 3: PROVENANCE & CHAIN OF CUSTODY */}
        <Card className="p-6 space-y-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Provenance & Ownership Chain
          </h3>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Ownership Status</span>
              <span className="font-semibold text-emerald-600">
                {ownershipChain.isOriginalOwner ? 'Original First-Hand Owner' : 'Transferred Asset'}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Acquisition Date</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatDate(product.purchaseDate)}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Original Merchant / Seller</span>
              <span className="font-semibold text-gray-900 dark:text-white">{product.sellerName}</span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Transfers Recorded</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {ownershipChain.transferCount} transfer(s)
              </span>
            </div>
          </div>
        </Card>

        {/* SECTION 4: FINANCIAL SUMMARY (INR) */}
        <Card className="p-6 space-y-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <IndianRupee className="w-5 h-5 text-emerald-600" />
            Verified Total Cost of Ownership (TCO)
          </h3>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Initial Acquisition Price</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatCurrency(financials.purchasePrice)}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Total Service Expenditure</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatCurrency(financials.totalServiceExpenditure)}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Other Recorded Expenses</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatCurrency(financials.additionalExpensesTotal)}
              </span>
            </div>

            <div className="flex justify-between py-2 bg-emerald-50 dark:bg-emerald-950/40 px-3 rounded-lg">
              <span className="font-bold text-emerald-900 dark:text-emerald-200">Total Cost of Ownership</span>
              <span className="font-black text-emerald-700 dark:text-emerald-400 text-base">
                {formatCurrency(financials.totalCostOfOwnership)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* SECTION 5: WARRANTY & SERVICE SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Warranty Card */}
        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              Warranty Status
            </h3>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                warranty.status === 'ACTIVE'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : warranty.status === 'EXPIRING_SOON'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {warranty.status}
            </span>
          </div>

          <div className="space-y-2 text-sm pt-2">
            <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Warranty Provider</span>
              <span className="font-semibold text-gray-900 dark:text-white">{warranty.provider}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Expiration Date</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {warranty.endDate ? formatDate(warranty.endDate) : 'Not documented'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Warranty Claims Filed</span>
              <span className="font-semibold text-gray-900 dark:text-white">{warranty.claimsCount}</span>
            </div>
          </div>
        </Card>

        {/* Documentation Proof */}
        <Card className="p-6 space-y-3">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Documentation Proofs
          </h3>

          <div className="space-y-2 text-sm pt-2">
            <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Purchase Invoice / Bill</span>
              <span
                className={`text-xs font-semibold flex items-center gap-1 ${
                  documentsSummary.hasInvoice ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                {documentsSummary.hasInvoice ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Attached & Verified
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" /> Missing
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Warranty Certificate</span>
              <span
                className={`text-xs font-semibold flex items-center gap-1 ${
                  documentsSummary.hasWarrantyDoc ? 'text-emerald-600' : 'text-gray-400'
                }`}
              >
                {documentsSummary.hasWarrantyDoc ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Attached
                  </>
                ) : (
                  'Not Attached'
                )}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Total Documents On File</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {documentsSummary.totalCount} document(s)
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* SECTION 6: SERVICE HISTORY TABLE */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary-600" />
            Verified Service & Maintenance Ledger ({serviceHistory.totalCount})
          </h3>
          <Link to="/services" className="text-xs font-semibold text-primary-600 hover:underline">
            Manage Services
          </Link>
        </div>

        {serviceHistory.records.length === 0 ? (
          <p className="text-xs text-gray-500 italic py-3">
            No service, repair, or maintenance events recorded yet for this item.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5">Issue</th>
                  <th className="p-2.5">Service Center</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {serviceHistory.records.map((s) => (
                  <tr key={s._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                    <td className="p-2.5">{formatDate(s.reportedDate)}</td>
                    <td className="p-2.5 font-medium">{s.serviceType.replace('_', ' ')}</td>
                    <td className="p-2.5 font-bold text-gray-900 dark:text-white">{s.issueTitle}</td>
                    <td className="p-2.5">{s.serviceCenterName || s.serviceProvider || 'Authorized'}</td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-semibold">
                        {s.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-right font-semibold">
                      {s.actualCost > 0 ? formatCurrency(s.actualCost) : 'Free'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* SECTION 7: ACTIONABLE RECOMMENDATIONS */}
      {verification.missingItems?.length > 0 && (
        <Card className="p-6 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 space-y-3">
          <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Recommendations to Maximize Passport Score ({verification.score}%)
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-amber-800 dark:text-amber-300">
            {verification.missingItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-900 rounded border border-amber-200/60 dark:border-amber-800/60">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* SECTION 8: ACTIVE PASSPORT SHARE LINKS */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary-600" />
              Cryptographic Share Links ({shareTokens.length})
            </h3>
            <p className="text-xs text-gray-500">
              Manage public or privacy-tiered access to this passport for buyers, insurance, or service technicians.
            </p>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setGeneratedShare(null);
              setShowShareModal(true);
            }}
          >
            Create New Link
          </Button>
        </div>

        {shareTokens.length === 0 ? (
          <p className="text-xs text-gray-500 italic py-2">
            No active share links created yet. Click "Create New Link" to generate a secure QR link.
          </p>
        ) : (
          <div className="space-y-2">
            {shareTokens.map((st) => (
              <div
                key={st._id}
                className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-gray-200/60 dark:border-gray-700/60"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                      {st.permissionLevel} ACCESS
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        st.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}
                    >
                      {st.status}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" /> {st.viewCount} views
                    </span>
                  </div>

                  <p className="text-xs text-gray-500">
                    {st.expiresAt ? `Expires on ${formatDate(st.expiresAt)}` : 'Permanent until revoked'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {st.status === 'ACTIVE' && (
                    <>
                      <button
                        onClick={() => copyToClipboard(st.shareUrl)}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-50 flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy Link
                      </button>

                      <button
                        onClick={() => handleRevokeShare(st._id)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Revoke
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* SHARE MODAL */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full p-6 space-y-4 border border-gray-200 dark:border-gray-800 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-primary-600" />
                Share Digital Ownership Passport
              </h3>
              <button onClick={() => setShowShareModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!generatedShare ? (
              <form onSubmit={handleCreateShare} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2">
                    Select Privacy & Permission Tier
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <input
                        type="radio"
                        name="permissionLevel"
                        value="BASIC"
                        checked={permissionLevel === 'BASIC'}
                        onChange={(e) => setPermissionLevel(e.target.value)}
                        className="mt-1"
                      />
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">BASIC Tier</p>
                        <p className="text-xs text-gray-500">
                          Product specs, brand, model, masked serial number, and verified badge. Zero financial or contact data.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <input
                        type="radio"
                        name="permissionLevel"
                        value="STANDARD"
                        checked={permissionLevel === 'STANDARD'}
                        onChange={(e) => setPermissionLevel(e.target.value)}
                        className="mt-1"
                      />
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">STANDARD Tier (Recommended)</p>
                        <p className="text-xs text-gray-500">
                          BASIC + Purchase date, seller name, service counts, warranty status, and completeness score.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <input
                        type="radio"
                        name="permissionLevel"
                        value="FULL"
                        checked={permissionLevel === 'FULL'}
                        onChange={(e) => setPermissionLevel(e.target.value)}
                        className="mt-1"
                      />
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">FULL Provenance Tier</p>
                        <p className="text-xs text-gray-500">
                          STANDARD + Purchase price, Total Cost of Ownership (₹), and detailed repair logs.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">
                    Link Expiration Duration
                  </label>
                  <select
                    value={expiresDays}
                    onChange={(e) => setExpiresDays(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                  >
                    <option value="7">7 Days</option>
                    <option value="30">30 Days (Recommended)</option>
                    <option value="90">90 Days</option>
                    <option value="0">Never (Manual Revocation Only)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t dark:border-gray-800">
                  <Button variant="secondary" type="button" onClick={() => setShowShareModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={sharing}>
                    {sharing ? 'Generating...' : 'Generate Secure Link & QR'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 text-center py-2">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Share Link & QR Code Generated
                </div>

                {generatedShare.qrCodeDataUrl && (
                  <div className="flex justify-center p-3 bg-white rounded-xl shadow-inner border border-gray-200 inline-block mx-auto">
                    <img
                      src={generatedShare.qrCodeDataUrl}
                      alt="Passport Verification QR Code"
                      className="w-48 h-48"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-xs text-gray-400">Public Share URL ({generatedShare.permissionLevel} Access)</p>
                  <div className="flex items-center gap-2 max-w-md mx-auto">
                    <input
                      type="text"
                      readOnly
                      value={generatedShare.shareUrl}
                      className="w-full px-3 py-2 text-xs font-mono bg-gray-50 dark:bg-gray-800 border rounded-lg"
                    />
                    <Button
                      size="sm"
                      onClick={() => copyToClipboard(generatedShare.shareUrl)}
                      className="flex-shrink-0"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                </div>

                <div className="pt-2">
                  <Button variant="secondary" onClick={() => setShowShareModal(false)}>
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
