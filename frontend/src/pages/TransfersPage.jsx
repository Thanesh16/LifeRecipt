import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightLeft,
  Inbox,
  Send,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Package,
} from 'lucide-react';
import transferService from '../services/transferService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function TransfersPage() {
  const [activeTab, setActiveTab] = useState('incoming');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const [incomingTransfers, setIncomingTransfers] = useState([]);
  const [outgoingTransfers, setOutgoingTransfers] = useState([]);
  const [transferHistory, setTransferHistory] = useState([]);

  // Action Modals State
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [modalType, setModalType] = useState(null); // 'accept' | 'reject' | 'cancel'
  const [submitting, setSubmitting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [tokenInput, setTokenInput] = useState('');

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      setError(null);
      const [incRes, outRes, histRes] = await Promise.all([
        transferService.getIncomingTransfers(),
        transferService.getOutgoingTransfers(),
        transferService.getTransferHistory(),
      ]);

      setIncomingTransfers(incRes.data || []);
      setOutgoingTransfers(outRes.data || []);
      setTransferHistory(histRes.data || []);
    } catch (err) {
      console.error('Failed to load transfers:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load transfers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  const openModal = (transfer, type) => {
    setSelectedTransfer(transfer);
    setModalType(type);
    setRejectReason('');
    setTokenInput(transfer.transferToken || '');
    setActionSuccess(null);
  };

  const closeModal = () => {
    setSelectedTransfer(null);
    setModalType(null);
    setRejectReason('');
    setTokenInput('');
  };

  const handleAccept = async () => {
    if (!selectedTransfer) return;
    try {
      setSubmitting(true);
      setError(null);
      await transferService.acceptTransfer(selectedTransfer._id, tokenInput || selectedTransfer.transferToken);
      setActionSuccess(`Successfully accepted ownership of ${selectedTransfer.productId?.productName || 'product'}!`);
      closeModal();
      await fetchTransfers();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to accept transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedTransfer) return;
    try {
      setSubmitting(true);
      setError(null);
      await transferService.rejectTransfer(selectedTransfer._id, rejectReason);
      setActionSuccess(`Declined transfer of ${selectedTransfer.productId?.productName || 'product'}.`);
      closeModal();
      await fetchTransfers();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to decline transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedTransfer) return;
    try {
      setSubmitting(true);
      setError(null);
      await transferService.cancelTransfer(selectedTransfer._id);
      setActionSuccess(`Cancelled transfer for ${selectedTransfer.productId?.productName || 'product'}.`);
      closeModal();
      await fetchTransfers();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to cancel transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Completed
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            Declined
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <XCircle className="w-3.5 h-3.5" />
            Cancelled
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary-500/10 border border-primary-500/20 rounded-xl text-primary-400">
              <ArrowRightLeft className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Ownership Transfers</h1>
              <p className="text-sm text-slate-400">
                Securely transfer ownership and chain of custody with verified document migration
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-emerald-400 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-slate-400 hover:text-slate-200 text-xs uppercase tracking-wider"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between text-rose-400 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-slate-400 hover:text-slate-200 text-xs uppercase tracking-wider"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-8">
        <button
          onClick={() => setActiveTab('incoming')}
          className={`pb-4 text-sm font-medium transition-colors relative flex items-center gap-2 ${
            activeTab === 'incoming'
              ? 'text-primary-400 border-b-2 border-primary-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Incoming Transfers</span>
          {incomingTransfers.length > 0 && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-500/20 text-primary-300">
              {incomingTransfers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('outgoing')}
          className={`pb-4 text-sm font-medium transition-colors relative flex items-center gap-2 ${
            activeTab === 'outgoing'
              ? 'text-primary-400 border-b-2 border-primary-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Outgoing Transfers</span>
          {outgoingTransfers.length > 0 && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300">
              {outgoingTransfers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-4 text-sm font-medium transition-colors relative flex items-center gap-2 ${
            activeTab === 'history'
              ? 'text-primary-400 border-b-2 border-primary-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Transfer History</span>
        </button>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          {/* Incoming Tab Content */}
          {activeTab === 'incoming' && (
            <div className="space-y-4">
              {incomingTransfers.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="No incoming transfers"
                  description="When someone sends you product ownership, it will appear here for your review and acceptance."
                />
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {incomingTransfers.map((transfer) => {
                    const product = transfer.productId || {};
                    const sender = transfer.fromUserId || {};
                    return (
                      <Card key={transfer._id} className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                          <div className="space-y-3 flex-1">
                            <div className="flex items-center gap-3">
                              <span className="p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300">
                                <Package className="w-5 h-5" />
                              </span>
                              <div>
                                <h3 className="text-lg font-bold text-slate-100">
                                  {product.productName || 'Unknown Product'}
                                </h3>
                                <p className="text-sm text-slate-400">
                                  {product.brand ? `${product.brand} ` : ''}
                                  {product.model ? `• ${product.model} ` : ''}
                                  {product.category ? `• ${product.category}` : ''}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-sm">
                              <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/40">
                                <span className="text-xs text-slate-400 block">From Owner</span>
                                <span className="font-medium text-slate-200">
                                  {sender.name || sender.email || 'Verified Owner'}
                                </span>
                                <span className="text-xs text-slate-500 block">{sender.email}</span>
                              </div>

                              <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/40">
                                <span className="text-xs text-slate-400 block">Purchase Value</span>
                                <span className="font-medium text-slate-200">
                                  {formatCurrency(product.purchasePrice)}
                                </span>
                                <span className="text-xs text-slate-500 block">
                                  Original: {formatDate(product.purchaseDate)}
                                </span>
                              </div>

                              <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/40">
                                <span className="text-xs text-slate-400 block">Transfer Expiry</span>
                                <span className="font-medium text-amber-400 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  {formatDate(transfer.expiresAt)}
                                </span>
                                <span className="text-xs text-slate-500 block">Action required</span>
                              </div>
                            </div>

                            {transfer.notes && (
                              <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/50 text-xs text-slate-300">
                                <span className="font-semibold text-slate-400 block mb-1">Owner's Note:</span>
                                {transfer.notes}
                              </div>
                            )}

                            <div className="flex items-center gap-2 text-xs text-emerald-400/90 pt-1">
                              <ShieldCheck className="w-4 h-4" />
                              <span>
                                Invoices, receipts, and warranty documents will automatically transfer to your LifeReceipt account upon acceptance.
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-row lg:flex-col gap-3 justify-end items-stretch lg:min-w-[160px]">
                            <Button
                              variant="primary"
                              onClick={() => openModal(transfer, 'accept')}
                              className="w-full flex items-center justify-center gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Accept Transfer
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => openModal(transfer, 'reject')}
                              className="w-full flex items-center justify-center gap-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border-rose-500/20"
                            >
                              <XCircle className="w-4 h-4" />
                              Decline
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Outgoing Tab Content */}
          {activeTab === 'outgoing' && (
            <div className="space-y-4">
              {outgoingTransfers.length === 0 ? (
                <EmptyState
                  icon={Send}
                  title="No outgoing transfers"
                  description="When you initiate an ownership transfer from a product page, it will be listed here while awaiting the recipient's acceptance."
                />
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {outgoingTransfers.map((transfer) => {
                    const product = transfer.productId || {};
                    return (
                      <Card key={transfer._id} className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                          <div className="space-y-3 flex-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300">
                                  <Package className="w-5 h-5" />
                                </span>
                                <div>
                                  <h3 className="text-lg font-bold text-slate-100">
                                    {product.productName || 'Unknown Product'}
                                  </h3>
                                  <p className="text-sm text-slate-400">
                                    {product.brand ? `${product.brand} ` : ''}
                                    {product.model ? `• ${product.model}` : ''}
                                  </p>
                                </div>
                              </div>
                              {getStatusBadge(transfer.status)}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-sm">
                              <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/40">
                                <span className="text-xs text-slate-400 block">Recipient</span>
                                <span className="font-medium text-slate-200">{transfer.recipientEmail}</span>
                                <span className="text-xs text-slate-500 block">Awaiting acceptance</span>
                              </div>

                              <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/40">
                                <span className="text-xs text-slate-400 block">Initiated Date</span>
                                <span className="font-medium text-slate-200">
                                  {formatDate(transfer.createdAt)}
                                </span>
                                <span className="text-xs text-slate-500 block">7-day handshake window</span>
                              </div>

                              <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/40">
                                <span className="text-xs text-slate-400 block">Expires On</span>
                                <span className="font-medium text-amber-400 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  {formatDate(transfer.expiresAt)}
                                </span>
                                <span className="text-xs text-slate-500 block">Auto-reverts if ignored</span>
                              </div>
                            </div>

                            <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/40 text-xs text-slate-300">
                              <span className="font-semibold text-slate-400 block mb-1">Transfer Token (Handshake Code):</span>
                              <code className="px-2 py-1 bg-slate-900 rounded font-mono text-primary-400 text-xs select-all">
                                {transfer.transferToken}
                              </code>
                              <span className="text-slate-500 block mt-1">
                                Share this token with the recipient if they are accepting manually.
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-amber-400/90 pt-1">
                              <Clock className="w-4 h-4" />
                              <span>
                                Ownership and historical expenses remain securely yours until the recipient accepts the transfer.
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-row lg:flex-col gap-3 justify-end items-stretch lg:min-w-[160px]">
                            {product._id && (
                              <Link to={`/products/${product._id}`} className="w-full">
                                <Button variant="secondary" className="w-full flex items-center justify-center gap-2">
                                  <ExternalLink className="w-4 h-4" />
                                  View Product
                                </Button>
                              </Link>
                            )}
                            <Button
                              variant="secondary"
                              onClick={() => openModal(transfer, 'cancel')}
                              className="w-full flex items-center justify-center gap-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border-rose-500/20"
                            >
                              <XCircle className="w-4 h-4" />
                              Cancel Transfer
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* History Tab Content */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {transferHistory.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="No transfer history"
                  description="Completed, declined, or cancelled transfers will be archived here in your permanent chain of custody ledger."
                />
              ) : (
                <div className="space-y-3">
                  {transferHistory.map((transfer) => {
                    const product = transfer.productId || {};
                    const isSender = transfer.fromUserId?._id
                      ? transfer.fromUserId._id === transfer.fromUserId?._id
                      : true;

                    return (
                      <Card key={transfer._id} className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300">
                              <Package className="w-4 h-4" />
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-slate-100">
                                  {product.productName || 'Archived Asset'}
                                </h4>
                                {getStatusBadge(transfer.status)}
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Recipient: <span className="text-slate-300">{transfer.recipientEmail}</span> • Handshake Date: {formatDate(transfer.updatedAt || transfer.createdAt)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            {transfer.status === 'ACCEPTED' && (
                              <span className="flex items-center gap-1 text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Chain of Custody Updated
                              </span>
                            )}
                            {transfer.status === 'REJECTED' && transfer.notes && (
                              <span className="text-rose-400">Reason: {transfer.notes}</span>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Accept Modal */}
      {modalType === 'accept' && selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Accept Ownership Transfer</h3>
                <p className="text-xs text-slate-400">Confirm transfer of product and documents</p>
              </div>
            </div>

            <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/50 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Product:</span>
                <span className="font-semibold text-slate-200">
                  {selectedTransfer.productId?.productName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">From:</span>
                <span className="text-slate-200">
                  {selectedTransfer.fromUserId?.email || selectedTransfer.fromUserId?.name}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Transfer Handshake Token
              </label>
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Enter transfer token"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary-500 font-mono"
              />
              <p className="text-xs text-slate-500 mt-1">
                Pre-filled with verified token from the transfer invitation.
              </p>
            </div>

            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300/90 space-y-1">
              <span className="font-semibold block">What happens next:</span>
              <p>• The product will be added to your active catalog.</p>
              <p>• Associated invoices, receipts, and warranty files will migrate to your account.</p>
              <p>• The prior owner's historical expenses will remain in their private ledger.</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={closeModal}
                disabled={submitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleAccept}
                disabled={submitting || !tokenInput}
                className="flex-1"
              >
                {submitting ? 'Accepting...' : 'Confirm Acceptance'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Modal */}
      {modalType === 'reject' && selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Decline Transfer</h3>
                <p className="text-xs text-slate-400">Return ownership back to sender</p>
              </div>
            </div>

            <p className="text-sm text-slate-300">
              Are you sure you want to decline the transfer for{' '}
              <strong className="text-slate-100">{selectedTransfer.productId?.productName}</strong>?
              Ownership will remain with the sender.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Reason for declining (Optional)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Sent by mistake, wrong product details, etc."
                rows={3}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={closeModal}
                disabled={submitting}
                className="flex-1"
              >
                Go Back
              </Button>
              <Button
                variant="secondary"
                onClick={handleReject}
                disabled={submitting}
                className="flex-1 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/20"
              >
                {submitting ? 'Declining...' : 'Confirm Decline'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {modalType === 'cancel' && selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Cancel Outgoing Transfer</h3>
                <p className="text-xs text-slate-400">Revert product status back to Active</p>
              </div>
            </div>

            <p className="text-sm text-slate-300">
              Are you sure you want to cancel the transfer to{' '}
              <strong className="text-slate-100">{selectedTransfer.recipientEmail}</strong> for{' '}
              <strong className="text-slate-100">{selectedTransfer.productId?.productName}</strong>?
            </p>

            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 text-xs text-slate-400">
              The pending transfer token will be invalidated immediately, and your product's status will revert to <span className="text-slate-200 font-semibold">Active</span>.
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={closeModal}
                disabled={submitting}
                className="flex-1"
              >
                Keep Transfer
              </Button>
              <Button
                variant="secondary"
                onClick={handleCancel}
                disabled={submitting}
                className="flex-1 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/20"
              >
                {submitting ? 'Cancelling...' : 'Confirm Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
