import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Upload,
  Search,
  Download,
  Eye,
  Trash2,
  Package,
  Plus,
  X,
  AlertCircle,
  RefreshCw,
  FileCheck,
} from 'lucide-react';
import documentService from '../services/documentService';
import EmptyState from '../components/common/EmptyState';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';

const DOC_TYPES = [
  'ALL',
  'RECEIPT',
  'INVOICE',
  'WARRANTY',
  'MANUAL',
  'SERVICE_INVOICE',
  'INSURANCE',
  'PURCHASE_ORDER',
  'DELIVERY_DOCUMENT',
  'OTHER',
];

export const DocumentsPage = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('ALL');
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);

  // Quick Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadDocType, setUploadDocType] = useState('RECEIPT');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedType !== 'ALL') params.documentType = selectedType;
      const res = await documentService.getDocuments(params);
      if (res.success && res.data) {
        setDocuments(res.data.documents || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [selectedType]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a file to upload.');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const res = await documentService.uploadAndExtract(uploadFile, uploadDocType);
      if (res.success) {
        setIsUploadOpen(false);
        setUploadFile(null);
        fetchDocuments();
      }
    } catch (err) {
      const isTimeout =
        err.code === 'ECONNABORTED' ||
        err.message?.toLowerCase().includes('timeout') ||
        err.response?.data?.message?.toLowerCase().includes('timeout');

      const friendlyMsg = isTimeout
        ? 'Document processing took longer than expected. Please retry or upload a clearer copy.'
        : (err.response?.data?.message || err.message || 'Failed to upload document');

      setUploadError(friendlyMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this document from your vault?')) return;
    try {
      await documentService.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete document');
    }
  };

  const filteredDocs = documents.filter((doc) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      doc.fileName.toLowerCase().includes(q) ||
      doc.documentType.toLowerCase().includes(q) ||
      (doc.productId?.productName && doc.productId.productName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Digital Document Vault
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Encrypted personal repository for receipts, warranty certificates, and device manuals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDocuments}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Upload className="w-4 h-4" />}
            onClick={() => setIsUploadOpen(true)}
          >
            Upload Document
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        <Input
          placeholder="Search documents by filename, category, or linked product..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
        />

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {DOC_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                selectedType === type
                  ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Documents Grid */}
      {loading ? (
        <LoadingSpinner label="Accessing encrypted document vault..." size="lg" />
      ) : filteredDocs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Your Document Vault is Empty"
          description="Uploaded purchase receipts, PDF invoices, and warranty cards will be stored securely with end-to-end user isolation, instantly accessible whenever you need to submit a claim."
          badgeText="Document Vault"
          actionLabel="Upload First Document"
          actionIcon={<Upload className="w-4 h-4" />}
          onAction={() => setIsUploadOpen(true)}
          upcomingFeatures={[
            'Full-text OCR search inside document scans and PDFs',
            '1-Click PDF export for tax or homeowner insurance filing',
            'Automated matching between uploaded receipts and registered assets',
            'Secure encrypted cloud backup with zero public exposure',
          ]}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => (
            <div
              key={doc._id}
              className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-sky-500/30 transition-all flex flex-col justify-between space-y-4 glow-card"
            >
              <div>
                {/* Header Badges */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      {doc.documentType}
                    </span>
                    {doc.status && doc.status !== 'PROCESSED' && (
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        doc.status === 'CONFIRMED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {doc.status}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {doc.pageCount && doc.pageCount > 1 ? `${doc.pageCount}p • ` : ''}{(doc.fileSize / 1024).toFixed(0)} KB
                  </span>
                </div>

                {/* File Title */}
                <h4 className="text-sm font-semibold text-slate-100 truncate" title={doc.fileName}>
                  {doc.fileName}
                </h4>

                <p className="text-[11px] text-slate-400 mt-1">
                  Uploaded: {new Date(doc.createdAt).toLocaleDateString()}
                </p>

                {/* Associated Product if linked */}
                {doc.productId && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Linked Asset</span>
                    <Link
                      to={`/products/${doc.productId._id}`}
                      className="text-xs font-medium text-sky-400 hover:underline inline-flex items-center gap-1 mt-0.5"
                    >
                      <Package className="w-3 h-3" />
                      <span>{doc.productId.productName}</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => documentService.downloadFile(doc._id, doc.fileName, false)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>

                <button
                  onClick={() => documentService.downloadFile(doc._id, doc.fileName, true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium text-sky-400 hover:text-white bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>

                <button
                  onClick={() => handleDelete(doc._id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Delete Document"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Upload Document to Vault</h3>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Document Type
                </label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-slate-100"
                >
                  {DOC_TYPES.filter((t) => t !== 'ALL').map((dt) => (
                    <option key={dt} value={dt}>
                      {dt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Select Document File (JPG, PNG, PDF max 10MB)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setUploadFile(f);
                  }}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-500/10 file:text-sky-400 hover:file:bg-sky-500/20 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsUploadOpen(false)}
                  disabled={isUploading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isUploading}
                  disabled={!uploadFile}
                >
                  Upload & Secure
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;
