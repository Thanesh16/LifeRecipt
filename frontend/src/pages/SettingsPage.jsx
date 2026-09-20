import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import emailReceiptService from '../services/emailReceiptService';
import authService from '../services/authService';
import passportService from '../services/passportService';
import {
  User,
  Mail,
  Shield,
  Bell,
  IndianRupee,
  Database,
  LogOut,
  RefreshCw,
  Unlink,
  CheckCircle2,
  Sliders,
  Sparkles,
  Lock,
  AlertTriangle,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Eye,
  Activity,
  XCircle,
  X,
  FileText,
} from 'lucide-react';
import { formatDate } from '../utils/formatters';

export const SettingsPage = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [currency, setCurrency] = useState(user?.preferences?.currency || 'INR');
  const [emailAlerts, setEmailAlerts] = useState(
    user?.preferences?.notifications?.emailAlerts ?? true
  );
  const [warrantyReminders, setWarrantyReminders] = useState(
    user?.preferences?.notifications?.warrantyReminders ?? true
  );

  // Connected Accounts State
  const [connections, setConnections] = useState([]);
  const [connecting, setConnecting] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [disconnectingId, setDisconnectingId] = useState(null);

  // Data & Privacy Settings
  const [syncFrequency, setSyncFrequency] = useState(24);
  const [syncPeriodDays, setSyncPeriodDays] = useState(90);
  const [autoDiscover, setAutoDiscover] = useState(true);
  const [autoEnrich, setAutoEnrich] = useState(true);

  // Security & Audit Trail State (Phase 15)
  const [shares, setShares] = useState([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [revokingShareId, setRevokingShareId] = useState(null);
  const [copiedShareId, setCopiedShareId] = useState(null);

  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [totalAuditPages, setTotalAuditPages] = useState(1);

  // Account Deletion State (Phase 15)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [message, setMessage] = useState('');

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

  const fetchShares = async () => {
    setLoadingShares(true);
    try {
      const res = await passportService.getUserShares();
      if (res.success && Array.isArray(res.data)) {
        setShares(res.data);
      }
    } catch (err) {
      console.warn('[Shares Fetch Error]', err);
    } finally {
      setLoadingShares(false);
    }
  };

  const fetchAuditLogs = async (page = 1) => {
    setLoadingAudit(true);
    try {
      const res = await authService.getAuditLog({ page, limit: 10 });
      if (res.success && res.data) {
        setAuditLogs(res.data.logs || []);
        setAuditPage(res.data.pagination?.page || 1);
        setTotalAuditPages(res.data.pagination?.pages || 1);
      }
    } catch (err) {
      console.warn('[Audit Log Fetch Error]', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  useEffect(() => {
    if (activeTab === 'security') {
      fetchShares();
      fetchAuditLogs(1);
    }
  }, [activeTab]);

  const handleSavePreferences = (e) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleConnectProvider = async (providerName) => {
    setConnecting(true);
    setMessage('');
    try {
      if (providerName === 'GMAIL') {
        const redirectUri = `${window.location.origin}/oauth/google/callback`;
        const authData = await emailReceiptService.getGoogleAuthUrl(redirectUri);
        const authUrl = authData.authUrl || authData.data?.authUrl;
        const isConfigured = authData.configured || authData.data?.configured;

        if (isConfigured && authUrl) {
          window.location.href = authUrl;
          return;
        } else {
          setMessage(authData.message || 'Gmail OAuth configuration required. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.');
          return;
        }
      }
      setMessage(`${providerName} integration requires OAuth app credentials.`);
    } catch (err) {
      console.error('[Connect Error]', err);
      setMessage(err.response?.data?.message || err.message || 'Failed to initiate email connection');
    } finally {
      setConnecting(false);
    }
  };

  const handleSyncConnection = async (id) => {
    setSyncingId(id);
    try {
      const res = await emailReceiptService.syncAccount(id);
      setMessage(`Mailbox synchronized! Discovered ${res.data?.newCandidatesCount || 0} purchase candidate(s).`);
      setTimeout(() => setMessage(''), 4000);
      await fetchConnections();
    } catch (err) {
      console.error('[Sync Error]', err);
    } finally {
      setSyncingId(null);
    }
  };

  const handleDisconnect = async (id) => {
    if (!window.confirm('Disconnect this email account? Previously confirmed products and documents will remain in your ledger.')) {
      return;
    }
    setDisconnectingId(id);
    try {
      await emailReceiptService.disconnectAccount(id);
      setMessage('Account disconnected. Credentials removed.');
      setTimeout(() => setMessage(''), 3000);
      await fetchConnections();
    } catch (err) {
      console.error('[Disconnect Error]', err);
    } finally {
      setDisconnectingId(null);
    }
  };

  // Passport Share Revocation (Phase 15)
  const handleRevokeShare = async (shareId) => {
    if (!window.confirm('Revoke this passport share link? Anyone attempting to visit this link will immediately receive an access denied error.')) {
      return;
    }
    setRevokingShareId(shareId);
    try {
      await passportService.revokeShareToken(shareId);
      setMessage('Passport share link revoked immediately.');
      setTimeout(() => setMessage(''), 3000);
      await fetchShares();
      await fetchAuditLogs(1);
    } catch (err) {
      console.error('[Revoke Share Error]', err);
    } finally {
      setRevokingShareId(null);
    }
  };

  const handleCopyShareUrl = (shareId, url) => {
    navigator.clipboard.writeText(url);
    setCopiedShareId(shareId);
    setTimeout(() => setCopiedShareId(null), 2000);
  };

  // Safe Account Deletion (Phase 15)
  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (deleteConfirmText !== 'DELETE MY ACCOUNT') {
      setDeleteError('Please type "DELETE MY ACCOUNT" exactly to confirm.');
      return;
    }
    if (!deletePassword) {
      setDeleteError('Please enter your account password.');
      return;
    }

    setIsDeletingAccount(true);
    setDeleteError('');
    try {
      await authService.deleteAccount(deletePassword);
      setIsDeleteModalOpen(false);
      alert('Your account and all associated records have been permanently wiped. You will now be redirected to the sign-in page.');
      logout();
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message || 'Failed to delete account. Please verify password.');
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
          Platform & Account Settings
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Manage your personal credentials, connected email accounts, data privacy, and security controls.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
          Preferences saved locally.
        </div>
      )}

      {message && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'profile'
              ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          Profile & Preferences
        </button>
        <button
          onClick={() => setActiveTab('connected_accounts')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'connected_accounts'
              ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          Connected Accounts
          {connections.filter((c) => c.status === 'CONNECTED').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block ml-1" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('sync')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'sync'
              ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Data & Sync
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'security'
              ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          Privacy & Security
        </button>
      </div>

      {/* TAB 1: Profile & Preferences */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <Card
            title="Personal Profile"
            subtitle="Your identity within the LifeReceipt ownership network"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <Input
                label="Full Name"
                value={user?.name || ''}
                disabled
                leftIcon={<User className="w-4 h-4" />}
              />
              <Input
                label="Email Address"
                value={user?.email || ''}
                disabled
                leftIcon={<Mail className="w-4 h-4" />}
              />
              <Input
                label="Account Role"
                value={user?.role?.toUpperCase() || 'USER'}
                disabled
                leftIcon={<Shield className="w-4 h-4" />}
              />
              <Input
                label="Member Since"
                value={formatDate(user?.createdAt)}
                disabled
              />
            </div>
          </Card>

          <Card
            title="Preferences & Alerts"
            subtitle="Currency formatting and reminder thresholds"
          >
            <form onSubmit={handleSavePreferences} className="space-y-5 max-w-2xl">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Default Ledger Currency
                </label>
                <div className="relative">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 px-3.5 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  >
                    <option value="INR">INR (₹) - Indian Rupee (Default)</option>
                    <option value="USD">USD ($) - United States Dollar</option>
                    <option value="EUR">EUR (€) - Euro</option>
                    <option value="GBP">GBP (£) - British Pound</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="block text-xs font-medium text-slate-300">
                  Notification Channels
                </label>

                <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={(e) => setEmailAlerts(e.target.checked)}
                    className="rounded border-slate-700 text-sky-500 focus:ring-sky-500"
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Email Notifications</p>
                    <p className="text-[11px] text-slate-400">Receive email digests and critical warranty notices.</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={warrantyReminders}
                    onChange={(e) => setWarrantyReminders(e.target.checked)}
                    className="rounded border-slate-700 text-sky-500 focus:ring-sky-500"
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Warranty Expiration Warnings</p>
                    <p className="text-[11px] text-slate-400">Trigger warnings 30 days and 7 days prior to expiry.</p>
                  </div>
                </label>
              </div>

              <div className="pt-2">
                <Button type="submit" variant="primary" size="md">
                  Save Preferences
                </Button>
              </div>
            </form>
          </Card>

          <Card
            title="Security & Session"
            subtitle="Session revocation and active signout"
          >
            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="font-semibold text-xs text-slate-200">Sign out of session</p>
                <p className="text-[11px] text-slate-400">Discard active JWT token from this browser</p>
              </div>
              <Button
                variant="danger"
                size="sm"
                leftIcon={<LogOut className="w-3.5 h-3.5" />}
                onClick={logout}
              >
                Sign Out
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: Connected Accounts */}
      {activeTab === 'connected_accounts' && (
        <div className="space-y-6">
          <Card
            title="Connected Email Accounts"
            subtitle="Authorize LifeReceipt to discover purchase receipts using read-only permissions"
          >
            <div className="space-y-6 max-w-2xl">
              {/* Active Connections List */}
              {connections.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Authorized Inboxes
                  </h4>
                  {connections.map((conn) => {
                    const isConnected = conn.status === 'CONNECTED';
                    return (
                      <div
                        key={conn._id}
                        className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-100">{conn.provider}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                isConnected
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              }`}
                            >
                              {conn.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300">{conn.emailAddress}</p>
                          <p className="text-[11px] text-slate-500">
                            Last synced: {conn.lastSyncedAt ? formatDate(conn.lastSyncedAt) : 'Never'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {isConnected && (
                            <Button
                              size="sm"
                              variant="outline"
                              leftIcon={
                                <RefreshCw className={`w-3 h-3 ${syncingId === conn._id ? 'animate-spin' : ''}`} />
                              }
                              onClick={() => handleSyncConnection(conn._id)}
                              disabled={syncingId === conn._id}
                            >
                              {syncingId === conn._id ? 'Syncing...' : 'Sync Now'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="danger"
                            leftIcon={<Unlink className="w-3 h-3" />}
                            onClick={() => handleDisconnect(conn._id)}
                            disabled={disconnectingId === conn._id}
                          >
                            Disconnect
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-800 text-center py-6 space-y-2">
                  <Mail className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-xs text-slate-300 font-semibold">No Email Inboxes Connected</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Connect your personal Google or Microsoft account to automatically find purchase invoices and receipts.
                  </p>
                </div>
              )}

              {/* Provider Connect Actions */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Available Providers
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
                    <div>
                      <h5 className="text-xs font-bold text-slate-100">Google Gmail</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Read-only access (gmail.readonly). Discovers receipts and tax invoices.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      className="w-full"
                      onClick={() => handleConnectProvider('GMAIL')}
                      disabled={connecting}
                    >
                      Connect Gmail
                    </Button>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
                    <div>
                      <h5 className="text-xs font-bold text-slate-100">Microsoft Outlook</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Read-only access (Mail.Read). Scans Outlook & Hotmail purchase orders.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => handleConnectProvider('OUTLOOK')}
                      disabled={connecting}
                    >
                      Connect Microsoft
                    </Button>
                  </div>
                </div>
              </div>

              {/* Security Notice */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-400 space-y-1">
                <span className="font-semibold text-slate-300 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-sky-400" />
                  Email Privacy Safeguards:
                </span>
                <p>• Only emails matching purchase indicators (e.g. invoice, receipt, GSTIN) are analyzed.</p>
                <p>• Tokens are encrypted at rest using AES-256-GCM and never exposed to the frontend.</p>
                <p>• We never send email, delete email, or access unrelated personal messages.</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: Data & Sync */}
      {activeTab === 'sync' && (
        <div className="space-y-6">
          <Card
            title="Data & Synchronization Controls"
            subtitle="Configure historical scan depths, automated polling, and external enrichment"
          >
            <div className="space-y-5 max-w-2xl text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Historical Email Scan Period
                </label>
                <select
                  value={syncPeriodDays}
                  onChange={(e) => setSyncPeriodDays(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 px-3.5 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  <option value={30}>Past 30 Days</option>
                  <option value={90}>Past 90 Days (Recommended)</option>
                  <option value={180}>Past 180 Days</option>
                  <option value={365}>Past 365 Days (1 Year)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Initial email discovery cutoff window. Subsequent scans are strictly incremental.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Sync Frequency
                </label>
                <select
                  value={syncFrequency}
                  onChange={(e) => setSyncFrequency(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 px-3.5 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  <option value={6}>Every 6 Hours</option>
                  <option value={12}>Every 12 Hours</option>
                  <option value={24}>Daily (Every 24 Hours - Recommended)</option>
                  <option value={0}>Manual Only (Sync on button click)</option>
                </select>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoDiscover}
                    onChange={(e) => setAutoDiscover(e.target.checked)}
                    className="rounded border-slate-700 text-sky-500 focus:ring-sky-500"
                  />
                  <div>
                    <p className="font-semibold text-slate-200">Automatic Receipt Candidate Discovery</p>
                    <p className="text-[11px] text-slate-400">
                      Discovered purchase candidates appear in your Email Receipts inbox for user review. No product is created without explicit user confirmation.
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoEnrich}
                    onChange={(e) => setAutoEnrich(e.target.checked)}
                    className="rounded border-slate-700 text-sky-500 focus:ring-sky-500"
                  />
                  <div>
                    <p className="font-semibold text-slate-200">External Product Intelligence Enrichment</p>
                    <p className="text-[11px] text-slate-400">
                      Automatically retrieve authoritative manufacturer specifications, official user manuals, and support portals for verified hardware assets.
                    </p>
                  </div>
                </label>
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setMessage('Data & sync preferences saved successfully.');
                    setTimeout(() => setMessage(''), 3000);
                  }}
                >
                  Save Sync Preferences
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: Privacy & Security (Phase 15) */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Section 1: Active Passport Shares Management */}
          <Card
            title="Active Passport Share Links"
            subtitle="Manage publicly accessible cryptographic share links to your Digital Ownership Passports"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Links grant external parties read-only access with tier-filtered data. Revoking immediately denies access.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<RefreshCw className={`w-3 h-3 ${loadingShares ? 'animate-spin' : ''}`} />}
                  onClick={fetchShares}
                  disabled={loadingShares}
                >
                  Refresh Links
                </Button>
              </div>

              {loadingShares ? (
                <div className="p-8 text-center text-xs text-slate-500">Loading active share tokens...</div>
              ) : shares.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center space-y-2">
                  <Shield className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-300">No Passport Share Links Active</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    You can generate cryptographic share links from any product's Digital Passport view to verify authenticity with prospective buyers or service centers.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {shares.map((share) => {
                    const isActive = share.status === 'ACTIVE';
                    const isRevoked = share.status === 'REVOKED';
                    const isExpired = share.status === 'EXPIRED';

                    return (
                      <div
                        key={share._id}
                        className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-slate-100">
                              {share.productName || 'Hardware Asset'}
                            </span>
                            {share.brand && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                {share.brand} {share.model}
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                isActive
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : isRevoked
                                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}
                            >
                              {share.status}
                            </span>
                            <span className="text-[10px] text-sky-400 font-mono bg-sky-950/40 px-2 py-0.5 rounded border border-sky-800/40">
                              Tier: {share.permissionLevel}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-[11px] text-slate-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3 text-slate-400" />
                              {share.viewCount} view{share.viewCount === 1 ? '' : 's'}
                            </span>
                            <span>Created: {formatDate(share.createdAt)}</span>
                            <span>
                              {share.expiresAt ? `Expires: ${formatDate(share.expiresAt)}` : 'Does not expire'}
                            </span>
                            {share.revokedAt && (
                              <span className="text-rose-400">Revoked on {formatDate(share.revokedAt)}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isActive && (
                            <button
                              onClick={() => handleCopyShareUrl(share._id, share.shareUrl)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                              title="Copy Link"
                            >
                              {copiedShareId === share._id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy Link</span>
                                </>
                              )}
                            </button>
                          )}

                          {isActive && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleRevokeShare(share._id)}
                              disabled={revokingShareId === share._id}
                            >
                              {revokingShareId === share._id ? 'Revoking...' : 'Revoke'}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          {/* Section 2: Security & Privacy Audit Trail */}
          <Card
            title="Recent Security Activity"
            subtitle="Tamper-evident audit trail of authentication and sensitive data operations"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-sky-400" />
                  <span className="text-xs text-slate-400">90-Day Rolling Security Retention Window</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<RefreshCw className={`w-3 h-3 ${loadingAudit ? 'animate-spin' : ''}`} />}
                  onClick={() => fetchAuditLogs(auditPage)}
                  disabled={loadingAudit}
                >
                  Refresh Log
                </Button>
              </div>

              {loadingAudit ? (
                <div className="p-8 text-center text-xs text-slate-500">Loading security audit records...</div>
              ) : auditLogs.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center space-y-2">
                  <Shield className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-300">No Security Events Recorded</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Security events like logins, document uploads, and passport shares will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                  {auditLogs.map((log) => {
                    const isSuccess = log.status === 'SUCCESS';
                    return (
                      <div key={log._id} className="p-3.5 flex items-start justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isSuccess ? 'bg-emerald-400' : 'bg-rose-400'
                              }`}
                            />
                            <span className="font-bold text-slate-100 font-mono text-[11px]">
                              {log.action}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                isSuccess
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-rose-500/10 text-rose-400'
                              }`}
                            >
                              {log.status}
                            </span>
                          </div>

                          {log.details && (
                            <p className="text-[11px] text-slate-400 truncate max-w-md">
                              {log.details.fileName && `File: ${log.details.fileName} • `}
                              {log.details.documentType && `Type: ${log.details.documentType} • `}
                              {log.details.permissionLevel && `Tier: ${log.details.permissionLevel} • `}
                              {log.details.transferId && `Transfer: ${log.details.transferId} • `}
                              {log.details.reason && `Reason: ${log.details.reason}`}
                            </p>
                          )}

                          <div className="flex items-center gap-3 text-[10px] text-slate-500">
                            <span>IP: {log.ipAddress || '127.0.0.1'}</span>
                            {log.userAgent && (
                              <span className="truncate max-w-xs" title={log.userAgent}>
                                {log.userAgent.includes('Mozilla') ? 'Web Browser' : log.userAgent}
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="text-[11px] text-slate-500 shrink-0">
                          {formatDate(log.createdAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {totalAuditPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={auditPage <= 1 || loadingAudit}
                    onClick={() => fetchAuditLogs(auditPage - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-slate-400">
                    Page {auditPage} of {totalAuditPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={auditPage >= totalAuditPages || loadingAudit}
                    onClick={() => fetchAuditLogs(auditPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Section 3: Danger Zone — Permanent Account Deletion */}
          <div className="p-5 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-rose-300">Danger Zone: Permanent Account Deletion</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Once you delete your account, there is no going back. All registered hardware assets, purchase invoices, service logs, and passport cryptographic tokens will be irreversibly destroyed.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => {
                  setDeletePassword('');
                  setDeleteConfirmText('');
                  setDeleteError('');
                  setIsDeleteModalOpen(true);
                }}
              >
                Delete LifeReceipt Account
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Account Deletion Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Permanently Delete Account?</h3>
              </div>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl">
              <p className="font-semibold text-rose-300">This action cannot be undone:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                <li>All registered products and ownership histories will be erased.</li>
                <li>All uploaded invoice PDFs and image binaries on disk will be deleted.</li>
                <li>All active passport share tokens will be permanently revoked.</li>
                <li>Any pending ownership transfers will be cancelled.</li>
              </ul>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {deleteError}
              </div>
            )}

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Confirm Account Password
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-rose-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  To confirm, type <span className="font-mono text-rose-400">DELETE MY ACCOUNT</span> below:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE MY ACCOUNT"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-rose-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeletingAccount}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  disabled={isDeletingAccount || deleteConfirmText !== 'DELETE MY ACCOUNT' || !deletePassword}
                >
                  {isDeletingAccount ? 'Permanently Deleting...' : 'Permanently Delete'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
