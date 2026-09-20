import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ShieldCheck,
  Package,
  Receipt,
  Sparkles,
  ArrowRight,
  Clock,
  FileCheck2,
  Lock,
} from 'lucide-react';
import Button from '../components/common/Button';
import { useAuth } from '../context/AuthContext';

export const LandingPage = () => {
  const { isAuthenticated, loading } = useAuth();

  // If user is already authenticated, redirect straight to dashboard
  if (!loading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const features = [
    {
      icon: Receipt,
      title: 'Digital Asset Ledger',
      description:
        'Transform physical receipts and digital invoices into clean, structured ownership records with strict data isolation.',
    },
    {
      icon: Clock,
      title: 'Automated Expiry Alerts',
      description:
        'Never forfeit a valid warranty or missed return window again with proactive schedule monitoring.',
    },
    {
      icon: Sparkles,
      title: 'AI Ownership Intelligence',
      description:
        'Future-ready assistant infrastructure for instant claim guidance, manual lookups, and repair recommendations.',
    },
    {
      icon: Lock,
      title: 'Zero-Leak Data Privacy',
      description:
        'Production security foundation ensuring every asset, invoice, and metric is cryptographically scoped to you alone.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-sky-500 selection:text-white">
      {/* Top Navigation */}
      <header className="max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between border-b border-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-slate-950 shadow-lg shadow-sky-500/20">
            <ShieldCheck className="w-6 h-6 font-bold" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white">
              LIFERECEIPT
            </span>
            <span className="text-[11px] block text-slate-400 font-medium">
              Ownership Intelligence
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>
          <Link to="/register">
            <Button variant="primary" size="sm">
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6 py-16 md:py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs font-semibold uppercase tracking-wider mb-8">
          <Sparkles className="w-3.5 h-3.5" />
          Production Platform Foundation v1.0
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight">
          AI-Powered Digital Ownership{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-sky-300 to-cyan-400">
            Intelligence Platform
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          The permanent command center for your high-value possessions. Centralize warranties, track lifecycle depreciation, preserve receipts, and manage claims without chaos.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/register" className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="primary"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Create Free Account
            </Button>
          </Link>
          <Link to="/login" className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="secondary"
              className="w-full sm:w-auto"
            >
              Sign In to Dashboard
            </Button>
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm hover:border-sky-500/40 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-100 mb-2">
                  {feat.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {feat.description}
                </p>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} LIFERECEIPT. Enterprise-Grade Asset Intelligence.</p>
          <div className="flex items-center gap-6 text-slate-400">
            <span>React + Express + MongoDB</span>
            <span>JWT Isolated Architecture</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
