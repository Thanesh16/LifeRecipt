import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  FileText,
  Clock,
  Wrench,
  IndianRupee,
  AlertTriangle,
  Lock,
  ExternalLink,
  CheckCircle2,
  Package,
} from 'lucide-react';
import passportService from '../services/passportService';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function PublicPassportPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchPublicPassport = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await passportService.getPublicPassport(token);
        setData(res.data);
      } catch (err) {
        console.error('Failed to load public passport:', err);
        setError(
          err.response?.data?.message ||
            'This digital ownership passport link is invalid, expired, or has been revoked by the owner.'
        );
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchPublicPassport();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-sm text-slate-400">Verifying Cryptographic Passport Token...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white">Passport Access Restricted</h2>
          <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-block px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
            >
              Go to LifeReceipt Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { permissionLevel, passport, viewCount } = data;
  const { product, verification, warranty } = passport;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Brand header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-white text-base">
              LR
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white">LifeReceipt</h2>
              <p className="text-[10px] text-slate-400">Digital Ownership & Provenance Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-sky-400">
              {permissionLevel} VIEW
            </span>
          </div>
        </div>

        {/* Passport Certificate Banner */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/30 rounded-2xl space-y-4 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold tracking-widest text-sky-400 uppercase">
                Verified Public Ownership Record
              </span>
              <h1 className="text-2xl font-black text-white">{product.productName}</h1>
              <p className="text-xs text-slate-300">
                {product.brand} • {product.model}
              </p>
            </div>

            <div className="flex items-center gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800 backdrop-blur-sm self-start sm:self-auto">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Integrity Seal</p>
                <p className="text-xs font-bold text-white">{verification?.badgeTitle || 'Digital Passport'}</p>
                {verification?.score && (
                  <p className="text-[11px] text-sky-400 font-bold">{verification.score}% Verified</p>
                )}
              </div>
            </div>
          </div>

          {/* Masked Serial / Category */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800/80 text-xs">
            <div>
              <p className="text-slate-400">Category</p>
              <p className="font-bold text-slate-200 mt-0.5">{product.category}</p>
            </div>
            <div>
              <p className="text-slate-400">Hardware Serial</p>
              <p className="font-mono font-bold text-sky-300 mt-0.5">{product.serialNumber || '••••••••'}</p>
            </div>
            <div>
              <p className="text-slate-400">Ownership Provenance</p>
              <p className="font-semibold text-emerald-400 mt-0.5">
                {passport.ownershipChain?.isOriginalOwner ? 'Original Owner' : 'Transferred'}
              </p>
            </div>
          </div>
        </div>

        {/* STANDARD & FULL: Additional details */}
        {(permissionLevel === 'STANDARD' || permissionLevel === 'FULL') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Purchase Baseline */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-400" />
                Acquisition Baseline
              </h4>
              <div className="text-xs space-y-1.5 pt-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Purchase Date:</span>
                  <span className="font-semibold text-slate-200">{formatDate(product.purchaseDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Retailer / Seller:</span>
                  <span className="font-semibold text-slate-200">{product.sellerName || 'Verified'}</span>
                </div>
              </div>
            </div>

            {/* Warranty Overview */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                Warranty Status
              </h4>
              <div className="text-xs space-y-1.5 pt-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Coverage Status:</span>
                  <span className="font-semibold text-emerald-400">{warranty?.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Warranty Provider:</span>
                  <span className="font-semibold text-slate-200">{warranty?.provider || 'Manufacturer'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FULL TIER: Verified Financials & Service History */}
        {permissionLevel === 'FULL' && passport.financials && (
          <div className="space-y-4">
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <IndianRupee className="w-4 h-4 text-emerald-400" />
                Verified Financials (INR)
              </h4>
              <div className="grid grid-cols-3 gap-3 text-xs pt-1">
                <div>
                  <p className="text-slate-400">Acquisition Price</p>
                  <p className="text-sm font-bold text-slate-100 mt-0.5">
                    {formatCurrency(passport.financials.purchasePrice)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Service Spend</p>
                  <p className="text-sm font-bold text-slate-100 mt-0.5">
                    {formatCurrency(passport.financials.totalServiceExpenditure)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Total Cost of Ownership</p>
                  <p className="text-sm font-black text-emerald-400 mt-0.5">
                    {formatCurrency(passport.financials.totalCostOfOwnership)}
                  </p>
                </div>
              </div>
            </div>

            {/* Service history */}
            {passport.serviceHistory?.records?.length > 0 && (
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-primary-400" />
                  Recorded Maintenance History
                </h4>
                <div className="divide-y divide-slate-800 text-xs">
                  {passport.serviceHistory.records.map((s) => (
                    <div key={s._id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-200">{s.issueTitle}</p>
                        <p className="text-slate-400 text-[11px]">
                          {formatDate(s.reportedDate)} • {s.serviceType.replace('_', ' ')} • {s.serviceCenterName || 'Center'}
                        </p>
                      </div>
                      <span className="font-semibold text-slate-300">
                        {s.actualCost > 0 ? formatCurrency(s.actualCost) : 'Free'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Guarantee */}
        <div className="p-4 bg-slate-900/50 border border-slate-800/80 rounded-xl text-center space-y-1">
          <p className="text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Verified by LifeReceipt Ownership Intelligence Engine
          </p>
          <p className="text-[11px] text-slate-500">
            Zero-Hallucination Policy: All data reflects confirmed purchase invoices, verifiable serials, and registered maintenance logs.
          </p>
        </div>
      </div>
    </div>
  );
}
