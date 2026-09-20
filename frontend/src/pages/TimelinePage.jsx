import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  History,
  ShoppingCart,
  FileText,
  ShieldCheck,
  RotateCcw,
  MessageSquare,
  Wrench,
  Clock,
  Package,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import timelineService from '../services/timelineService';
import documentService from '../services/documentService';
import EmptyState from '../components/common/EmptyState';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatDate } from '../utils/formatters';

const FILTER_TABS = [
  { id: 'ALL', label: 'All Activities', icon: History },
  { id: 'PURCHASED', label: 'Purchases', icon: ShoppingCart },
  { id: 'DOCUMENT_ADDED', label: 'Documents', icon: FileText },
  { id: 'WARRANTY_INFO_ADDED', label: 'Warranty', icon: ShieldCheck },
  { id: 'RETURN_INFO_ADDED', label: 'Returns', icon: RotateCcw },
  { id: 'NOTE_ADDED', label: 'Owner Notes', icon: MessageSquare },
];

const getEventVisuals = (eventType) => {
  switch (eventType) {
    case 'PURCHASED':
      return {
        icon: ShoppingCart,
        color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
        dot: 'bg-sky-400 ring-sky-500/30',
        badge: 'Acquisition',
      };
    case 'DOCUMENT_ADDED':
      return {
        icon: FileText,
        color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
        dot: 'bg-violet-400 ring-violet-500/30',
        badge: 'Document',
      };
    case 'WARRANTY_INFO_ADDED':
      return {
        icon: ShieldCheck,
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        dot: 'bg-emerald-400 ring-emerald-500/30',
        badge: 'Warranty',
      };
    case 'RETURN_INFO_ADDED':
      return {
        icon: RotateCcw,
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        dot: 'bg-amber-400 ring-amber-500/30',
        badge: 'Return Window',
      };
    case 'NOTE_ADDED':
      return {
        icon: MessageSquare,
        color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
        dot: 'bg-cyan-400 ring-cyan-500/30',
        badge: 'Note',
      };
    case 'SERVICE':
    case 'MAINTENANCE':
    case 'REPAIR':
      return {
        icon: Wrench,
        color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        dot: 'bg-purple-400 ring-purple-500/30',
        badge: 'Service',
      };
    default:
      return {
        icon: Clock,
        color: 'text-slate-400 bg-slate-800 border-slate-700',
        dot: 'bg-slate-400 ring-slate-700',
        badge: 'Event',
      };
  }
};

export const TimelinePage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('ALL');
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [error, setError] = useState(null);

  const fetchTimeline = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 15 };
      if (selectedType !== 'ALL') {
        params.eventType = selectedType;
      }
      const res = await timelineService.getGlobalTimeline(params);
      if (res.success && res.data) {
        setEvents(res.data.events || []);
        setPagination(res.data.pagination || { page: 1, limit: 15, total: 0, pages: 1 });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load timeline activity');
    } finally {
      setLoading(false);
    }
  }, [selectedType]);

  useEffect(() => {
    fetchTimeline(1);
  }, [fetchTimeline]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      fetchTimeline(newPage);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Ownership Timeline Activity
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Chronological lifecycle audit trail across all your physical assets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 font-medium">
            Total Records: <strong className="text-white">{pagination.total}</strong>
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {FILTER_TABS.map((tab) => {
          const Icon = tab.icon;
          const isSelected = selectedType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedType(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                isSelected
                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-400 shadow-sm'
                  : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 text-center">
          <LoadingSpinner size="lg" label="Loading ownership timeline activity..." />
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          {error}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={History}
          title="No Ownership Activities Found"
          description={
            selectedType === 'ALL'
              ? 'No lifecycle events have been recorded yet. Events will populate as you register products, attach documents, and log notes.'
              : `No events matching "${FILTER_TABS.find((t) => t.id === selectedType)?.label}" were found.`
          }
          actionLabel="View Products Catalog"
          onAction={() => window.location.assign('/products')}
        />
      ) : (
        <div className="relative pl-6 md:pl-8 border-l border-slate-800 space-y-6">
          {events.map((evt) => {
            const visuals = getEventVisuals(evt.eventType);
            const IconComponent = visuals.icon;
            const product = evt.productId;

            return (
              <div key={evt._id} className="relative group">
                {/* Timeline Dot Indicator */}
                <span
                  className={`absolute -left-[31px] md:-left-[39px] top-3 w-3.5 h-3.5 rounded-full ring-4 ring-slate-950 ${visuals.dot}`}
                />

                <div className="bg-slate-900 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-4 transition-all duration-200 shadow-sm space-y-3">
                  {/* Top Bar: Event Badge, Product Link, Source, Date */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${visuals.color}`}
                      >
                        <IconComponent className="w-3 h-3" />
                        {visuals.badge}
                      </span>

                      {product ? (
                        <Link
                          to={`/products/${product._id}`}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[11px] font-medium text-slate-300 hover:text-sky-400 hover:border-sky-500/30 transition-colors"
                        >
                          <Package className="w-3 h-3 text-slate-400" />
                          <span>{product.productName}</span>
                          {product.category && (
                            <span className="text-slate-500 text-[10px]">
                              ({product.category})
                            </span>
                          )}
                        </Link>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">
                          (Archived Asset)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {evt.source === 'USER' ? 'Owner Note' : 'System Verified'}
                      </span>
                      <span className="text-slate-300 font-medium">
                        {formatDate(evt.eventDate)}
                      </span>
                    </div>
                  </div>

                  {/* Event Details */}
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-white">
                      {evt.title}
                    </h3>
                    {evt.description && (
                      <p className="text-xs text-slate-300 leading-relaxed break-words whitespace-pre-wrap">
                        {evt.description}
                      </p>
                    )}
                  </div>

                  {/* Document Attachment Reference if available */}
                  {evt.relatedDocumentId && (
                    <div className="pt-2 border-t border-slate-800/50 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-slate-300 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        <span className="truncate font-medium">
                          {evt.relatedDocumentId.fileName || 'Attached Document'}
                        </span>
                        {evt.relatedDocumentId.documentType && (
                          <span className="text-[10px] text-slate-500 uppercase">
                            • {evt.relatedDocumentId.documentType}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() =>
                          documentService.downloadFile(
                            evt.relatedDocumentId._id || evt.relatedDocumentId,
                            evt.relatedDocumentId.fileName || 'document',
                            false
                          )
                        }
                        className="flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors shrink-0 ml-3"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View File
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Pagination Controls */}
          {pagination.pages > 1 && (
            <div className="pt-6 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Page {pagination.page} of {pagination.pages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TimelinePage;
