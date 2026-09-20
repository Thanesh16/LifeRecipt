import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RotateCcw,
  FileText,
  Wrench,
  Clock,
  Edit,
  Trash2,
  Calendar,
  IndianRupee,
  Building,
  Phone,
  Tag,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Upload,
  Download,
  Eye,
  Plus,
  X,
  File,
  ShoppingCart,
  MessageSquare,
  History,
  Sparkles,
  ArrowRightLeft,
  Award,
  Globe,
  BookOpen,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import productService from '../services/productService';
import documentService from '../services/documentService';
import timelineService from '../services/timelineService';
import expenseService from '../services/expenseService';
import analyticsService from '../services/analyticsService';
import lifecycleService from '../services/lifecycleService';
import transferService from '../services/transferService';
import productIntelligenceService from '../services/productIntelligenceService';
import serviceRecordService from '../services/serviceRecordService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatCurrency, formatDate } from '../utils/formatters';
import { calculateWarrantyStatus, calculateReturnStatus } from '../utils/statusCalculator';

const EXPENSE_TYPES = ['REPAIR', 'SERVICE', 'MAINTENANCE', 'ACCESSORY', 'REPLACEMENT', 'OTHER'];

const CATEGORIES = [
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

const STATUSES = ['Active', 'In Repair', 'Sold', 'Disposed', 'Archived', 'Transfer Pending', 'Transferred'];
const WARRANTY_TYPES = ['Manufacturer', 'Extended', 'Store', 'Third-Party', 'Lifetime', 'None'];
const DOCUMENT_TYPES = ['RECEIPT', 'INVOICE', 'WARRANTY', 'MANUAL', 'SERVICE_INVOICE', 'OTHER'];

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

export const ProductDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  // Delete Modal State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Attach Document Modal State
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [attachFile, setAttachFile] = useState(null);
  const [attachDocType, setAttachDocType] = useState('RECEIPT');
  const [isAttaching, setIsAttaching] = useState(false);
  const [attachError, setAttachError] = useState('');

  // Timeline Note Modal State (Add & Edit)
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteModalMode, setNoteModalMode] = useState('add'); // 'add' | 'edit'
  const [editingEventId, setEditingEventId] = useState(null);
  const [noteForm, setNoteForm] = useState({
    title: '',
    description: '',
    eventDate: new Date().toISOString().split('T')[0],
  });
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteError, setNoteError] = useState('');

  // Combined Phase 7 & 8: Ownership Cost & Expense State
  const [costData, setCostData] = useState(null);
  const [costLoading, setCostLoading] = useState(false);
  const [insightsData, setInsightsData] = useState(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseModalMode, setExpenseModalMode] = useState('add'); // 'add' | 'edit'
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    expenseType: 'REPAIR',
    amount: '',
    expenseDate: new Date().toISOString().split('T')[0],
    title: '',
    description: '',
    vendorName: '',
    relatedDocumentId: '',
    notes: '',
  });
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [expenseError, setExpenseError] = useState('');

  // Combined Phase 9 & 10: Lifecycle & Transfer State
  const [lifecycleData, setLifecycleData] = useState(null);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [intelligenceData, setIntelligenceData] = useState(null);
  const [intelligenceRefreshing, setIntelligenceRefreshing] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferEmail, setTransferEmail] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');
  const [productServices, setProductServices] = useState([]);
  const [isLogServiceOpen, setIsLogServiceOpen] = useState(false);
  const [serviceSubmitting, setServiceSubmitting] = useState(false);
  const [serviceError, setServiceError] = useState('');
  const [newService, setNewService] = useState({
    serviceType: 'REPAIR',
    status: 'REQUESTED',
    serviceProvider: '',
    serviceCenterName: '',
    serviceCenterAddress: '',
    serviceCenterPhone: '',
    serviceCenterUrl: '',
    issueTitle: '',
    issueDescription: '',
    reportedDate: new Date().toISOString().split('T')[0],
    scheduledDate: '',
    completedDate: '',
    estimatedCost: '',
    actualCost: '',
    notes: '',
  });

  const handleCreateProductService = async (e) => {
    e.preventDefault();
    if (!newService.issueTitle) {
      setServiceError('Please provide an issue title.');
      return;
    }
    try {
      setServiceSubmitting(true);
      setServiceError('');
      const res = await serviceRecordService.createServiceRecord({
        ...newService,
        productId: id,
        estimatedCost: newService.estimatedCost ? Number(newService.estimatedCost) : 0,
        actualCost: newService.actualCost ? Number(newService.actualCost) : 0,
      });
      if (res.success && res.data) {
        setProductServices((prev) => [res.data, ...prev]);
        setIsLogServiceOpen(false);
        setNewService({
          serviceType: 'REPAIR',
          status: 'REQUESTED',
          serviceProvider: '',
          serviceCenterName: '',
          serviceCenterAddress: '',
          serviceCenterPhone: '',
          serviceCenterUrl: '',
          issueTitle: '',
          issueDescription: '',
          reportedDate: new Date().toISOString().split('T')[0],
          scheduledDate: '',
          completedDate: '',
          estimatedCost: '',
          actualCost: '',
          notes: '',
        });
        fetchCostAndExpenses();
      }
    } catch (err) {
      setServiceError(err.response?.data?.message || err.message || 'Failed to log service record');
    } finally {
      setServiceSubmitting(false);
    }
  };

  const handleRefreshIntelligence = async () => {
    setIntelligenceRefreshing(true);
    try {
      const res = await productIntelligenceService.refreshProductIntelligence(id);
      if (res.success && res.data) {
        setIntelligenceData(res.data);
      }
    } catch (err) {
      console.warn('[Intelligence Refresh Error]', err);
    } finally {
      setIntelligenceRefreshing(false);
    }
  };

  const fetchCostAndExpenses = async () => {
    try {
      setCostLoading(true);
      const [costRes, insRes] = await Promise.all([
        analyticsService.getProductCost(id),
        analyticsService.getProductInsights(id).catch(() => ({ success: false, data: { insights: [] } })),
      ]);
      if (costRes.success && costRes.data) {
        setCostData(costRes.data);
      }
      if (insRes.success && insRes.data) {
        setInsightsData(insRes.data);
      }
    } catch (cErr) {
      console.error('[Cost Fetch Error]', cErr);
    } finally {
      setCostLoading(false);
    }
  };

  const fetchTimeline = async () => {
    try {
      setTimelineLoading(true);
      const res = await timelineService.getProductTimeline(id);
      if (res.success && res.data?.events) {
        setTimelineEvents(res.data.events);
      }
    } catch (tErr) {
      console.error('[Timeline Fetch Error]', tErr);
    } finally {
      setTimelineLoading(false);
    }
  };

  const fetchProductAndDocs = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, docsRes, timeRes, costRes, insRes, lifeRes, intelRes, servRes] = await Promise.all([
        productService.getProductById(id),
        documentService.getDocuments({ productId: id }),
        timelineService.getProductTimeline(id).catch(() => ({ data: { events: [] } })),
        analyticsService.getProductCost(id).catch(() => ({ success: false, data: null })),
        analyticsService.getProductInsights(id).catch(() => ({ success: false, data: { insights: [] } })),
        lifecycleService.getProductLifecycle(id).catch(() => ({ success: false, data: null })),
        productIntelligenceService.getProductIntelligence(id).catch(() => ({ success: false, data: null })),
        serviceRecordService.getServiceRecords({ productId: id }).catch(() => ({ success: false, data: { records: [] } })),
      ]);

      if (prodRes.success && prodRes.data) {
        setProduct(prodRes.data);
      } else {
        throw new Error(prodRes.message || 'Product not found');
      }

      if (docsRes.success && docsRes.data) {
        setDocuments(docsRes.data.documents || []);
      }

      if (timeRes?.success && timeRes.data?.events) {
        setTimelineEvents(timeRes.data.events);
      }

      if (costRes?.success && costRes.data) {
        setCostData(costRes.data);
      }

      if (insRes?.success && insRes.data) {
        setInsightsData(insRes.data);
      }

      if (lifeRes?.success && lifeRes.data) {
        setLifecycleData(lifeRes.data);
      }

      if (intelRes?.success && intelRes.data) {
        setIntelligenceData(intelRes.data);
      }

      if (servRes?.data?.records) {
        setProductServices(servRes.data.records);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Product not found or access denied');
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateTransfer = async (e) => {
    e.preventDefault();
    if (!transferEmail) {
      setTransferError('Please enter recipient email');
      return;
    }
    setTransferSubmitting(true);
    setTransferError('');
    try {
      await transferService.initiateTransfer({
        productId: id,
        recipientEmail: transferEmail,
        notes: transferNotes,
      });
      setIsTransferModalOpen(false);
      setTransferEmail('');
      setTransferNotes('');
      setTransferSuccess('Ownership transfer initiated! The recipient has 7 days to accept.');
      fetchProductAndDocs();
    } catch (err) {
      setTransferError(err.response?.data?.message || err.message || 'Failed to initiate transfer');
    } finally {
      setTransferSubmitting(false);
    }
  };

  useEffect(() => {
    fetchProductAndDocs();
  }, [id]);

  const openAddExpenseModal = () => {
    setExpenseModalMode('add');
    setEditingExpenseId(null);
    setExpenseForm({
      expenseType: 'REPAIR',
      amount: '',
      expenseDate: new Date().toISOString().split('T')[0],
      title: '',
      description: '',
      vendorName: '',
      relatedDocumentId: '',
      notes: '',
    });
    setExpenseError('');
    setIsExpenseModalOpen(true);
  };

  const openEditExpenseModal = (exp) => {
    setExpenseModalMode('edit');
    setEditingExpenseId(exp._id);
    setExpenseForm({
      expenseType: exp.expenseType || 'REPAIR',
      amount: exp.amount || '',
      expenseDate: exp.expenseDate ? new Date(exp.expenseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      title: exp.title || '',
      description: exp.description || '',
      vendorName: exp.vendorName || '',
      relatedDocumentId: exp.relatedDocumentId?._id || exp.relatedDocumentId || '',
      notes: exp.notes || '',
    });
    setExpenseError('');
    setIsExpenseModalOpen(true);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.title?.trim()) {
      setExpenseError('Expense title is required');
      return;
    }
    const numAmt = parseFloat(expenseForm.amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      setExpenseError('Please enter a valid positive amount in ₹');
      return;
    }

    try {
      setExpenseSubmitting(true);
      setExpenseError('');

      const payload = {
        productId: id,
        expenseType: expenseForm.expenseType,
        amount: numAmt,
        expenseDate: expenseForm.expenseDate,
        title: expenseForm.title.trim(),
        description: expenseForm.description.trim(),
        vendorName: expenseForm.vendorName.trim(),
        relatedDocumentId: expenseForm.relatedDocumentId || null,
        notes: expenseForm.notes.trim(),
      };

      if (expenseModalMode === 'add') {
        await expenseService.createExpense(payload);
      } else {
        await expenseService.updateExpense(editingExpenseId, payload);
      }

      setIsExpenseModalOpen(false);
      await Promise.all([fetchCostAndExpenses(), fetchTimeline()]);
    } catch (err) {
      setExpenseError(err.response?.data?.message || 'Failed to save expense');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this expense record? This will also remove the corresponding timeline event.')) {
      return;
    }

    try {
      await expenseService.deleteExpense(expenseId);
      await Promise.all([fetchCostAndExpenses(), fetchTimeline()]);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete expense');
    }
  };

  const openAddNoteModal = () => {
    setNoteModalMode('add');
    setEditingEventId(null);
    setNoteForm({
      title: '',
      description: '',
      eventDate: new Date().toISOString().split('T')[0],
    });
    setNoteError('');
    setIsNoteModalOpen(true);
  };

  const openEditNoteModal = (event) => {
    setNoteModalMode('edit');
    setEditingEventId(event._id);
    setNoteForm({
      title: event.title || '',
      description: event.description || '',
      eventDate: event.eventDate
        ? new Date(event.eventDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
    });
    setNoteError('');
    setIsNoteModalOpen(true);
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!noteForm.title.trim()) {
      setNoteError('Note title is required.');
      return;
    }
    setNoteSubmitting(true);
    setNoteError('');
    try {
      if (noteModalMode === 'edit') {
        await timelineService.updateProductNote(id, editingEventId, noteForm);
      } else {
        await timelineService.createProductNote(id, noteForm);
      }
      setIsNoteModalOpen(false);
      await fetchTimeline();
    } catch (err) {
      setNoteError(err.response?.data?.message || 'Failed to save note');
    } finally {
      setNoteSubmitting(false);
    }
  };

  const handleDeleteNote = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this timeline note?')) return;
    try {
      await timelineService.deleteProductNote(id, eventId);
      await fetchTimeline();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete note');
    }
  };

  const openEditModal = () => {
    if (!product) return;
    setEditForm({
      productName: product.productName || '',
      category: product.category || 'Other',
      brand: product.brand || '',
      model: product.model || '',
      serialNumber: product.serialNumber || '',
      purchasePrice: product.purchasePrice || 0,
      currency: product.currency || 'INR',
      purchaseDate: product.purchaseDate ? new Date(product.purchaseDate).toISOString().split('T')[0] : '',
      sellerName: product.sellerName || '',
      sellerContact: product.sellerContact || '',
      hasWarranty: Boolean(product.warranty?.hasWarranty),
      warrantyProvider: product.warranty?.warrantyProvider || '',
      warrantyType: product.warranty?.warrantyType || 'None',
      warrantyStartDate: product.warranty?.warrantyStartDate ? new Date(product.warranty.warrantyStartDate).toISOString().split('T')[0] : '',
      warrantyEndDate: product.warranty?.warrantyEndDate ? new Date(product.warranty.warrantyEndDate).toISOString().split('T')[0] : '',
      returnEligible: Boolean(product.returnInfo?.returnEligible),
      returnStartDate: product.returnInfo?.returnStartDate ? new Date(product.returnInfo.returnStartDate).toISOString().split('T')[0] : '',
      returnEndDate: product.returnInfo?.returnEndDate ? new Date(product.returnInfo.returnEndDate).toISOString().split('T')[0] : '',
      returnPolicyNotes: product.returnInfo?.returnPolicyNotes || '',
      notes: product.notes || '',
      status: product.status || 'Active',
    });
    setUpdateError('');
    setIsEditOpen(true);
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    setUpdateError('');

    const payload = {
      productName: editForm.productName.trim(),
      category: editForm.category,
      brand: editForm.brand.trim(),
      model: editForm.model.trim(),
      serialNumber: editForm.serialNumber.trim(),
      purchasePrice: Number(editForm.purchasePrice) || 0,
      currency: editForm.currency,
      purchaseDate: editForm.purchaseDate || undefined,
      sellerName: editForm.sellerName.trim(),
      sellerContact: editForm.sellerContact.trim(),
      warranty: {
        hasWarranty: editForm.hasWarranty,
        warrantyProvider: editForm.warrantyProvider.trim(),
        warrantyType: editForm.warrantyType,
        warrantyStartDate: editForm.hasWarranty && editForm.warrantyStartDate ? editForm.warrantyStartDate : undefined,
        warrantyEndDate: editForm.hasWarranty && editForm.warrantyEndDate ? editForm.warrantyEndDate : undefined,
      },
      returnInfo: {
        returnEligible: editForm.returnEligible,
        returnStartDate: editForm.returnEligible && editForm.returnStartDate ? editForm.returnStartDate : undefined,
        returnEndDate: editForm.returnEligible && editForm.returnEndDate ? editForm.returnEndDate : undefined,
        returnPolicyNotes: editForm.returnPolicyNotes.trim(),
      },
      notes: editForm.notes.trim(),
      status: editForm.status,
    };

    try {
      const res = await productService.updateProduct(id, payload);
      if (res.success && res.data) {
        setProduct(res.data);
        setIsEditOpen(false);
        fetchTimeline();
      }
    } catch (err) {
      setUpdateError(err.response?.data?.message || 'Failed to update product details');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await productService.deleteProduct(id);
      navigate('/products', { replace: true });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete product');
      setIsDeleting(false);
    }
  };

  const handleAttachDocument = async (e) => {
    e.preventDefault();
    if (!attachFile) {
      setAttachError('Please select a file to attach.');
      return;
    }

    setIsAttaching(true);
    setAttachError('');
    try {
      const res = await documentService.uploadAndExtract(attachFile, attachDocType, id);
      if (res.success && res.data?.document) {
        setIsAttachOpen(false);
        setAttachFile(null);
        fetchProductAndDocs();
      }
    } catch (err) {
      const isTimeout =
        err.code === 'ECONNABORTED' ||
        err.message?.toLowerCase().includes('timeout') ||
        err.response?.data?.message?.toLowerCase().includes('timeout');

      const friendlyMsg = isTimeout
        ? 'Document processing took longer than expected. Please retry or upload a clearer copy.'
        : (err.response?.data?.message || 'Failed to attach document');

      setAttachError(friendlyMsg);
    } finally {
      setIsAttaching(false);
    }
  };

  const handleDeleteDoc = async (docId) => {
    if (!confirm('Are you sure you want to remove this document from your vault?')) return;
    try {
      await documentService.deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d._id !== docId));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete document');
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading asset ownership records..." size="lg" />;
  }

  if (error || !product) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto py-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Product Not Found</h2>
        <p className="text-sm text-slate-400">
          The requested product ID does not exist or does not belong to your authenticated user account.
        </p>
        <div className="pt-4">
          <Button variant="primary" size="md" onClick={() => navigate('/products')}>
            Return to Product Catalog
          </Button>
        </div>
      </div>
    );
  }

  const warrantyStatus = calculateWarrantyStatus(product.warranty);
  const returnStatus = calculateReturnStatus(product.returnInfo);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Navigation Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate('/products')}
        >
          Back to Product Catalog
        </Button>

        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/products/${id}/passport`}>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Award className="w-3.5 h-3.5 text-sky-400" />}
            >
              Digital Passport
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<ArrowRightLeft className="w-3.5 h-3.5" />}
            onClick={() => {
              setTransferError('');
              setIsTransferModalOpen(true);
            }}
            disabled={product.status === 'Transfer Pending' || product.status === 'Transferred'}
          >
            Transfer Ownership
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Edit className="w-3.5 h-3.5" />}
            onClick={openEditModal}
          >
            Edit Product
          </Button>
          <Button
            variant="danger"
            size="sm"
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => setIsDeleteOpen(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Transfer Pending Notice Banner */}
      {product.status === 'Transfer Pending' && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-300">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400 shrink-0">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-200">Ownership Transfer Pending</h3>
              <p className="text-xs text-amber-300/80 mt-0.5">
                An ownership transfer handshake has been initiated for this item. Ownership remains with you until the recipient accepts.
              </p>
            </div>
          </div>
          <Link to="/transfers">
            <Button size="sm" variant="secondary" className="whitespace-nowrap border-amber-500/30 text-amber-300 hover:bg-amber-500/20">
              Manage in Transfers
            </Button>
          </Link>
        </div>
      )}

      {/* Transfer Success Alert */}
      {transferSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-emerald-400 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{transferSuccess}</span>
          </div>
          <button
            onClick={() => setTransferSuccess('')}
            className="text-slate-400 hover:text-slate-200 text-xs uppercase"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* SECTION 1: Product Overview */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                {product.category}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  product.status === 'Active'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : product.status === 'In Repair'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {product.status}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {product.productName}
            </h1>

            <p className="text-sm text-slate-300">
              <span className="text-slate-400">Manufacturer: </span>
              <span className="font-semibold text-slate-200">{product.brand || 'Unspecified Brand'}</span>
              {product.model && (
                <>
                  <span className="text-slate-500 mx-2">•</span>
                  <span className="text-slate-400">Model: </span>
                  <span className="font-mono text-slate-200">{product.model}</span>
                </>
              )}
            </p>

            {product.serialNumber && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300">
                <span className="text-slate-500 uppercase font-semibold">Hardware S/N:</span>
                <span className="font-bold text-sky-400 select-all">{product.serialNumber}</span>
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 text-right min-w-[180px]">
            <span className="text-xs text-slate-400 uppercase font-semibold block">Tracked Asset Value</span>
            <span className="text-2xl font-black text-white mt-0.5 block">
              {formatCurrency(product.purchasePrice, product.currency)}
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Recorded: {formatDate(product.createdAt)}
            </span>
          </div>
        </div>
      </Card>

      {/* Grid for Sections 2, 3, and 4 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* SECTION 2: Purchase Information */}
        <Card
          title="2. Purchase Information"
          subtitle="Transaction verification & merchant details"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-slate-800 text-slate-400">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="text-slate-400 font-medium">Purchase Date</p>
                <p className="text-sm font-semibold text-slate-100 mt-0.5">
                  {formatDate(product.purchaseDate)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-slate-800 text-slate-400">
                <IndianRupee className="w-4 h-4" />
              </div>
              <div>
                <p className="text-slate-400 font-medium">Purchase Amount</p>
                <p className="text-sm font-semibold text-slate-100 mt-0.5">
                  {formatCurrency(product.purchasePrice, product.currency)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-slate-800 text-slate-400">
                <Building className="w-4 h-4" />
              </div>
              <div>
                <p className="text-slate-400 font-medium">Merchant / Seller</p>
                <p className="text-sm font-semibold text-slate-100 mt-0.5">
                  {product.sellerName || 'Direct / Unspecified'}
                </p>
              </div>
            </div>

            {product.sellerContact && (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-800 text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Seller Contact</p>
                  <p className="text-sm font-semibold text-slate-100 mt-0.5">
                    {product.sellerContact}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* SECTION 3: Warranty */}
        <Card
          title="3. Warranty Protection"
          subtitle="Coverage status & expiration countdown"
        >
          {product.warranty?.hasWarranty ? (
            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400 font-medium">Status</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                    warrantyStatus.badgeVariant === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : warrantyStatus.badgeVariant === 'warning'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : warrantyStatus.badgeVariant === 'danger'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {warrantyStatus.label}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-100">
                  {product.warranty.warrantyProvider || 'Manufacturer Warranty'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Type: {product.warranty.warrantyType || 'Standard'}
                </p>
              </div>

              <div className="space-y-2">
                {product.warranty.warrantyStartDate && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Coverage Start:</span>
                    <span className="text-slate-200 font-medium">
                      {formatDate(product.warranty.warrantyStartDate)}
                    </span>
                  </div>
                )}
                {product.warranty.warrantyEndDate && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Coverage Expiry:</span>
                    <span className="text-slate-200 font-medium">
                      {formatDate(product.warranty.warrantyEndDate)}
                    </span>
                  </div>
                )}
                {warrantyStatus.daysRemaining !== null && (
                  <div className="flex justify-between pt-1 border-t border-slate-800/60">
                    <span className="text-slate-400">Time Remaining:</span>
                    <span className={`font-semibold ${
                      warrantyStatus.isExpired
                        ? 'text-rose-400'
                        : warrantyStatus.isExpiringSoon
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}>
                      {warrantyStatus.daysRemaining < 0
                        ? `Expired ${Math.abs(warrantyStatus.daysRemaining)} days ago`
                        : `${warrantyStatus.daysRemaining} days`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400 space-y-2">
              <ShieldX className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="font-semibold text-slate-300">No Warranty Recorded</p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                No active warranty coverage is attached to this asset. You can add one anytime by editing this product.
              </p>
            </div>
          )}
        </Card>

        {/* SECTION 4: Return Period */}
        <Card
          title="4. Return Period"
          subtitle="Merchant return policy & deadline"
        >
          {product.returnInfo?.returnEligible ? (
            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400 font-medium">Eligibility</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                    returnStatus.badgeVariant === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : returnStatus.badgeVariant === 'warning'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : returnStatus.badgeVariant === 'danger'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {returnStatus.label}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-100">
                  Return / Exchange Permitted
                </p>
              </div>

              <div className="space-y-2">
                {product.returnInfo.returnStartDate && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Window Start:</span>
                    <span className="text-slate-200 font-medium">
                      {formatDate(product.returnInfo.returnStartDate)}
                    </span>
                  </div>
                )}
                {product.returnInfo.returnEndDate && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Window Deadline:</span>
                    <span className="text-slate-200 font-medium">
                      {formatDate(product.returnInfo.returnEndDate)}
                    </span>
                  </div>
                )}
                {returnStatus.daysRemaining !== null && (
                  <div className="flex justify-between pt-1 border-t border-slate-800/60">
                    <span className="text-slate-400">Time Remaining:</span>
                    <span className={`font-semibold ${
                      returnStatus.isExpired
                        ? 'text-slate-400'
                        : returnStatus.isExpiringSoon
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}>
                      {returnStatus.daysRemaining < 0
                        ? `Window closed ${Math.abs(returnStatus.daysRemaining)} days ago`
                        : `${returnStatus.daysRemaining} days remaining`}
                    </span>
                  </div>
                )}
              </div>

              {product.returnInfo.returnPolicyNotes && (
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80 text-[11px] text-slate-300">
                  <span className="text-slate-500 font-semibold block mb-0.5">Policy Terms:</span>
                  {product.returnInfo.returnPolicyNotes}
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400 space-y-2">
              <RotateCcw className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="font-semibold text-slate-300">Not Return Eligible</p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                No active return policy is tracked for this item (e.g. final sale, return window elapsed, or gift).
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Owner Notes if present */}
      {product.notes && (
        <Card title="Product Owner Notes">
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
            {product.notes}
          </p>
        </Card>
      )}

      {/* Grid for Sections 5, 6, and 7 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* SECTION 5: Documents & Receipts (ACTIVE IN PHASE 3) */}
        <Card
          title="5. Documents & Receipts"
          subtitle="Encrypted document vault for this product"
          action={
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setIsAttachOpen(true)}
            >
              Attach Document
            </Button>
          }
        >
          {documents.length === 0 ? (
            <div className="py-8 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-sky-400">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-200">
                  No Documents Attached
                </h4>
                <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                  Attach invoices, scanned receipts, user manuals, or warranty certificates directly to this product.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Upload className="w-3.5 h-3.5" />}
                onClick={() => setIsAttachOpen(true)}
              >
                Upload Document
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc._id}
                  className="p-3 rounded-xl border border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-100 truncate">
                        {doc.fileName}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5 text-[10px] text-slate-400">
                        <span className="font-medium text-sky-400">{doc.documentType}</span>
                        <span>•</span>
                        {doc.pageCount && doc.pageCount > 1 && (
                          <>
                            <span className="font-mono">{doc.pageCount} pages</span>
                            <span>•</span>
                          </>
                        )}
                        <span>{(doc.fileSize / 1024).toFixed(0)} KB</span>
                        {doc.status && (
                          <span className={`px-1 rounded text-[9px] font-mono ${
                            doc.status === 'CONFIRMED'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            {doc.status}
                          </span>
                        )}
                      </div>
                      {doc.extractedData?.invoiceNumber && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Inv: <span className="font-mono text-slate-300">#{doc.extractedData.invoiceNumber}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => documentService.downloadFile(doc._id, doc.fileName, false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                      title="Preview in new tab"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => documentService.downloadFile(doc._id, doc.fileName, true)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800"
                      title="Download file"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDoc(doc._id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                      title="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* SECTION 6: Ownership Cost & Expense History */}
        <Card
          title="6. Ownership Cost & Expense History"
          subtitle="Deterministic cost analytics, repairs & AI insights"
          action={
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={openAddExpenseModal}
            >
              Add Expense
            </Button>
          }
        >
          {costLoading && !costData ? (
            <div className="py-8 text-center">
              <LoadingSpinner size="sm" label="Calculating ownership costs..." />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Cost Summary Metric Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-medium">Purchase Cost</span>
                  <div className="text-sm font-bold text-white font-mono mt-0.5">
                    {formatCurrency(costData?.purchaseCost || product.purchasePrice || 0)}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-medium">Additional Costs</span>
                  <div className="text-sm font-bold text-amber-300 font-mono mt-0.5">
                    {formatCurrency(costData?.additionalCost || 0)}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-medium">Total Ownership Cost</span>
                  <div className="text-sm font-bold text-sky-400 font-mono mt-0.5">
                    {formatCurrency(costData?.totalOwnershipCost || product.purchasePrice || 0)}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-medium">Additional Cost %</span>
                  <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                    {costData?.additionalCostPercentage ? `${costData.additionalCostPercentage}%` : '0%'}
                  </div>
                </div>
              </div>

              {/* Category Breakdown (if additional cost exists) */}
              {costData?.additionalCost > 0 && costData?.categoryBreakdown && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Additional Cost Breakdown
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(costData.categoryBreakdown)
                      .filter(([_, amt]) => amt > 0)
                      .map(([cat, amt]) => (
                        <div
                          key={cat}
                          className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs flex items-center gap-1.5"
                        >
                          <span className="capitalize font-medium text-slate-300">
                            {cat.toLowerCase()}:
                          </span>
                          <span className="font-bold text-amber-300 font-mono">
                            {formatCurrency(amt)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Product AI Insights */}
              {insightsData?.insights && insightsData.insights.length > 0 && (
                <div className="space-y-2 pt-1 border-t border-slate-800/60">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Product Ownership Insights</span>
                  </div>
                  <div className="space-y-2">
                    {insightsData.insights.map((ins, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                          ins.level === 'WARNING'
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-200'
                            : ins.level === 'ACTION_REQUIRED'
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-200'
                            : 'bg-sky-500/10 border-sky-500/20 text-sky-200'
                        }`}
                      >
                        <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="font-semibold">{ins.title}</p>
                          <p className="text-[11px] opacity-90 leading-relaxed">{ins.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expense History Ledger */}
              <div className="pt-2 border-t border-slate-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">Expense History</span>
                  <span className="text-[10px] text-slate-400">
                    {costData?.expenses?.length || 0} recorded
                  </span>
                </div>

                {!costData?.expenses || costData.expenses.length === 0 ? (
                  <div className="py-6 text-center flex flex-col items-center justify-center space-y-2 bg-slate-950/40 rounded-xl border border-slate-800/60">
                    <Wrench className="w-6 h-6 text-slate-500" />
                    <p className="text-xs text-slate-400">No additional ownership expenses recorded yet.</p>
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      onClick={openAddExpenseModal}
                    >
                      Record First Expense
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {costData.expenses.map((exp) => (
                      <div
                        key={exp._id}
                        className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700/80 transition-colors flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                            <Wrench className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-100 truncate">
                                {exp.title}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-medium">
                                {exp.expenseType}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                              <span>{formatDate(exp.expenseDate)}</span>
                              {exp.vendorName && <span>• {exp.vendorName}</span>}
                              {exp.relatedDocumentId && (
                                <span className="text-violet-400 flex items-center gap-0.5">
                                  • <FileText className="w-2.5 h-2.5" /> Attached Doc
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-amber-300 font-mono text-xs">
                            {formatCurrency(exp.amount)}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditExpenseModal(exp)}
                              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                              title="Edit expense"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(exp._id)}
                              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Delete expense"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* SECTION 7: Ownership Timeline */}
        <Card
          title="7. Ownership Timeline"
          subtitle="Chronological asset history & notes"
          action={
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={openAddNoteModal}
            >
              Add Note
            </Button>
          }
        >
          {timelineLoading ? (
            <div className="py-8 text-center">
              <LoadingSpinner size="sm" label="Loading timeline..." />
            </div>
          ) : timelineEvents.length === 0 ? (
            <div className="py-8 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-200">No Timeline Events</h4>
                <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                  Timeline events will appear as you upload receipts, update warranty dates, or record manual notes.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={openAddNoteModal}
              >
                Add First Note
              </Button>
            </div>
          ) : (
            <div className="max-h-[440px] overflow-y-auto pr-1">
              <div className="relative pl-6 border-l border-slate-800 space-y-4 text-xs pt-1">
                {timelineEvents.map((evt) => {
                  const visuals = getEventVisuals(evt.eventType);
                  const IconComponent = visuals.icon;
                  const isUserNote = evt.source === 'USER' && evt.eventType === 'NOTE_ADDED';

                  return (
                    <div key={evt._id} className="relative group">
                      {/* Timeline Dot with Icon */}
                      <span
                        className={`absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full ring-4 ring-slate-950 ${visuals.dot}`}
                      />

                      <div className="bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 rounded-xl p-3 transition-colors space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${visuals.color}`}
                            >
                              <IconComponent className="w-2.5 h-2.5" />
                              {visuals.badge}
                            </span>
                            <span className="font-semibold text-slate-100 text-xs">
                              {evt.title}
                            </span>
                          </div>

                          {/* Action icons for manual notes */}
                          {isUserNote && (
                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEditNoteModal(evt)}
                                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                title="Edit note"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteNote(evt._id)}
                                className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                title="Delete note"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {evt.description && (
                          <p className="text-[11px] text-slate-300 leading-relaxed break-words whitespace-pre-wrap">
                            {evt.description}
                          </p>
                        )}

                        {/* Document reference if available */}
                        {evt.relatedDocumentId && (
                          <div className="mt-1 pt-1 flex items-center justify-between border-t border-slate-800/60 text-[11px]">
                            <span className="text-slate-400 flex items-center gap-1 truncate max-w-[170px]">
                              <FileText className="w-3 h-3 text-violet-400 shrink-0" />
                              <span className="truncate">
                                {evt.relatedDocumentId.fileName || 'Attached file'}
                              </span>
                            </span>
                            <button
                              onClick={() =>
                                documentService.downloadFile(
                                  evt.relatedDocumentId._id || evt.relatedDocumentId,
                                  evt.relatedDocumentId.fileName || 'document',
                                  false
                                )
                              }
                              className="text-[10px] font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-0.5"
                            >
                              <Eye className="w-3 h-3" /> View
                            </button>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                          <span>{formatDate(evt.eventDate)}</span>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400">
                            {evt.source === 'USER' ? 'Owner Note' : 'System Verified'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* SECTION 8: Product Lifecycle & Transfer Intelligence */}
      <Card
        title="8. Product Lifecycle & Transfer Intelligence"
        subtitle="Deterministic lifecycle stages, duration tracking, record completeness & chain of custody"
        action={
          <Button
            size="sm"
            variant="outline"
            leftIcon={<ArrowRightLeft className="w-3.5 h-3.5" />}
            onClick={() => {
              setTransferError('');
              setIsTransferModalOpen(true);
            }}
            disabled={product.status === 'Transfer Pending' || product.status === 'Transferred'}
          >
            Transfer Ownership
          </Button>
        }
      >
        {lifecycleData ? (
          <div className="space-y-6">
            {/* Top Stage Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Lifecycle Stage:</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      lifecycleData.stage === 'WARRANTY_ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : lifecycleData.stage === 'RETURN_PERIOD'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : lifecycleData.stage === 'TRANSFER_PENDING'
                        ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                        : lifecycleData.stage === 'LONG_TERM_OWNERSHIP'
                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        : lifecycleData.stage === 'ACTIVE_OWNERSHIP'
                        ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                        : lifecycleData.stage === 'WARRANTY_EXPIRED'
                        ? 'bg-slate-700/50 text-slate-300 border-slate-600'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}
                  >
                    {lifecycleData.stageLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                  {lifecycleData.stageDescription}
                </p>
              </div>

              {lifecycleData.actions?.length > 0 && (
                <div className="sm:text-right">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Recommended Action</span>
                  <span className="text-xs font-semibold text-primary-400 block mt-0.5">
                    {lifecycleData.actions[0].label}
                  </span>
                </div>
              )}
            </div>

            {/* Metrics Grid: Age & Completeness */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Ownership vs Product Age */}
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Ownership & Product Age
                </span>
                <div className="space-y-1.5 pt-1">
                  <div>
                    <span className="text-[11px] text-slate-400">Current Ownership:</span>
                    <p className="text-base font-bold text-white">
                      {lifecycleData.age.ownershipAgeFormatted}
                    </p>
                    {lifecycleData.age.ownershipStartDate && (
                      <span className="text-[10px] text-slate-400">
                        Since: {formatDate(lifecycleData.age.ownershipStartDate)}
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-400">Total Product Age:</span>
                    <p className="text-sm font-semibold text-slate-200">
                      {lifecycleData.age.productAgeFormatted}
                    </p>
                    {lifecycleData.age.isSecondHand && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        Second-Hand Custody
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 2: Record Completeness Score */}
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Record Completeness
                  </span>
                  <span className="text-xs font-bold text-primary-400">
                    {lifecycleData.completeness.score}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      lifecycleData.completeness.score >= 80
                        ? 'bg-emerald-500'
                        : lifecycleData.completeness.score >= 50
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${lifecycleData.completeness.score}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Rating: <strong className="text-slate-200 font-semibold">{lifecycleData.completeness.status}</strong></span>
                  <span>{lifecycleData.completeness.missingFields?.length || 0} missing</span>
                </div>

                {lifecycleData.completeness.missingFields?.length > 0 && (
                  <div className="pt-1">
                    <span className="text-[10px] text-slate-400 block mb-1">Missing attributes:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {lifecycleData.completeness.missingFields.slice(0, 3).map((mf) => (
                        <span
                          key={mf.key}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700"
                        >
                          +{mf.points}% {mf.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Card 3: Maintenance & Service History */}
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Service & Maintenance Activity
                </span>
                <div className="space-y-1.5 pt-1">
                  <div>
                    <span className="text-[11px] text-slate-400">Service / Repair Events:</span>
                    <p className="text-base font-bold text-white">
                      {lifecycleData.serviceStats.totalServiceRecords} recorded
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-400">Cumulative Service Cost:</span>
                    <p className="text-sm font-semibold text-amber-300 font-mono">
                      {formatCurrency(lifecycleData.serviceStats.totalServiceCost)}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Maintenance preserves functional health without indicating asset obsolescence.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-400">
            Lifecycle intelligence metrics calculating...
          </div>
        )}
      </Card>

      {/* SECTION 9: External Product Intelligence & Authoritative Data */}
      <Card
        title="9. External Product Intelligence & Authoritative Data"
        subtitle="Authoritative manufacturer specifications, manuals, support portals, and warranty terms"
        action={
          <Button
            size="sm"
            variant="outline"
            leftIcon={
              <RefreshCw className={`w-3.5 h-3.5 ${intelligenceRefreshing ? 'animate-spin' : ''}`} />
            }
            onClick={handleRefreshIntelligence}
            disabled={intelligenceRefreshing}
          >
            {intelligenceRefreshing ? 'Querying...' : 'Refresh Information'}
          </Button>
        }
      >
        {intelligenceData ? (
          intelligenceData.status === 'UNAVAILABLE' ? (
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 text-center space-y-1.5 py-8">
              <p className="text-xs font-semibold text-slate-300">
                External product information is currently unavailable.
              </p>
              <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                {intelligenceData.message || 'No authoritative external specifications match this item. Your stored purchase and warranty records remain fully active.'}
              </p>
            </div>
          ) : intelligenceData.status === 'AMBIGUOUS' ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-xs text-amber-300">
              <div className="flex items-center gap-2 font-semibold text-amber-200">
                <AlertCircle className="w-4 h-4" />
                <span>Multiple Possible Matches Found</span>
              </div>
              <p>
                {intelligenceData.message || 'Multiple product variants exist. Please specify your exact hardware model number.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Attribution & Provenance Bar */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>
                    Source:{' '}
                    <a
                      href={intelligenceData.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:underline font-semibold"
                    >
                      {intelligenceData.sourceName}
                    </a>
                  </span>
                  <span className="text-slate-600 hidden sm:inline">•</span>
                  <span className="text-slate-500">
                    Checked: {formatDate(intelligenceData.fetchedAt)}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit">
                  Verified {intelligenceData.sourceType.replace('_', ' ')}
                </span>
              </div>

              {/* Side-by-Side Comparison: Your Record vs Official External Data */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary-400" />
                    Your Ownership Record
                  </span>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Model (Receipt):</span>
                      <span className="font-semibold text-slate-100">
                        {product.model || product.productName}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Recorded Warranty:</span>
                      <span className="font-semibold text-slate-100">
                        {product.warranty?.hasWarranty
                          ? `${product.warranty.warrantyType || 'Standard'} (${product.warranty.warrantyProvider || 'Recorded'})`
                          : 'No warranty tracked'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Acquisition Merchant:</span>
                      <span className="font-semibold text-slate-100">
                        {product.sellerName || 'Direct Purchase'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-sky-400" />
                    Official External Information
                  </span>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Canonical Manufacturer Model:</span>
                      <span className="font-semibold text-slate-100">
                        {intelligenceData.model || intelligenceData.manufacturer}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Official Standard Warranty:</span>
                      <span className="font-semibold text-emerald-400">
                        {intelligenceData.officialWarranty?.description || '1 Year Standard Warranty'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Support Helpline:</span>
                      <span className="font-semibold text-slate-100">
                        {intelligenceData.serviceCenters?.[0]?.phone || 'Available Online'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Warranty Conflict Advisory (if present) */}
              {intelligenceData.warrantyComparison?.hasConflict && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl space-y-1 text-xs text-amber-300">
                  <div className="flex items-center gap-2 font-semibold text-amber-200">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Warranty Policy Discrepancy Detected</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {intelligenceData.warrantyComparison.message}
                  </p>
                </div>
              )}

              {/* Quick Action Links: Official Page, Manual, Support */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {intelligenceData.officialProductUrl && (
                  <a
                    href={intelligenceData.officialProductUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500/50 transition-colors text-center block group"
                  >
                    <Globe className="w-4 h-4 text-sky-400 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                    <span className="text-[11px] font-semibold text-slate-200 block">Product Page</span>
                    <span className="text-[9px] text-slate-500 flex items-center justify-center gap-0.5 mt-0.5">
                      Official <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  </a>
                )}

                {intelligenceData.supportUrl && (
                  <a
                    href={intelligenceData.supportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 transition-colors text-center block group"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-400 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                    <span className="text-[11px] font-semibold text-slate-200 block">Official Support</span>
                    <span className="text-[9px] text-slate-500 flex items-center justify-center gap-0.5 mt-0.5">
                      Help Portal <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  </a>
                )}

                {intelligenceData.manualUrl && (
                  <a
                    href={intelligenceData.manualUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 transition-colors text-center block group"
                  >
                    <BookOpen className="w-4 h-4 text-amber-400 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                    <span className="text-[11px] font-semibold text-slate-200 block">User Manual</span>
                    <span className="text-[9px] text-slate-500 flex items-center justify-center gap-0.5 mt-0.5">
                      PDF Guide <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  </a>
                )}

                {intelligenceData.warrantyUrl && (
                  <a
                    href={intelligenceData.warrantyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-violet-500/50 transition-colors text-center block group"
                  >
                    <Award className="w-4 h-4 text-violet-400 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                    <span className="text-[11px] font-semibold text-slate-200 block">Warranty Terms</span>
                    <span className="text-[9px] text-slate-500 flex items-center justify-center gap-0.5 mt-0.5">
                      Coverage <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  </a>
                )}
              </div>

              {/* Technical Specifications Grid */}
              {intelligenceData.specifications?.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Hardware Specifications
                  </h4>
                  <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 text-[11px] text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-4 font-semibold">Parameter</th>
                          <th className="py-2.5 px-4 font-semibold">Technical Detail</th>
                          <th className="py-2.5 px-4 font-semibold hidden sm:table-cell">Subsystem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {intelligenceData.specifications.map((spec) => (
                          <tr key={spec.key} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-2.5 px-4 font-semibold text-slate-200">
                              {spec.label}
                            </td>
                            <td className="py-2.5 px-4 text-slate-300">
                              {spec.value}
                            </td>
                            <td className="py-2.5 px-4 text-slate-500 text-[11px] hidden sm:table-cell">
                              {spec.group || 'General'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            Querying external product intelligence...
          </div>
        )}
      </Card>

      {/* SECTION 10: Warranty & Service Ecosystem */}
      <Card
        title="Warranty & Service Ecosystem"
        subtitle="Track repair history, maintenance visits, authorized service centers, and warranty claims."
        badge={
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
            <Wrench className="w-3 h-3" />
            {productServices.length} Records
          </span>
        }
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="primary"
              className="text-xs"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => {
                setServiceError('');
                setIsLogServiceOpen(true);
              }}
            >
              Log Service / Repair
            </Button>
            <Link to="/services">
              <Button size="sm" variant="secondary" className="text-xs">
                Services Hub
              </Button>
            </Link>
            <Link to={`/products/${id}/passport`}>
              <Button size="sm" variant="outline" className="text-xs">
                Passport
              </Button>
            </Link>
          </div>
        }
      >
        {productServices.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 space-y-2">
            <p>No repair or service records logged for this item yet.</p>
            <p className="text-slate-500 text-[11px]">
              Logging routine maintenance and repairs helps maximize your asset's Digital Passport score and provides verified proof of care.
            </p>
            <div className="pt-2">
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  setServiceError('');
                  setIsLogServiceOpen(true);
                }}
              >
                Log First Service Record
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {productServices.map((svc) => (
              <div
                key={svc._id}
                className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors space-y-3"
              >
                {/* Header Row: Badges, Claim Ref, Costs */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      {svc.serviceType.replace('_', ' ')}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        svc.status === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : svc.status === 'IN_SERVICE' || svc.status === 'SCHEDULED'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {svc.status}
                    </span>
                    {svc.warrantyClaimReference && (
                      <span className="font-mono text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded font-bold">
                        Claim: {svc.warrantyClaimReference}
                      </span>
                    )}
                    {svc.warrantyRelated && !svc.warrantyClaimReference && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-semibold">
                        Under Warranty
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    {svc.estimatedCost > 0 && (
                      <span className="text-slate-400">
                        Est: <strong className="text-slate-200">{formatCurrency(svc.estimatedCost)}</strong>
                      </span>
                    )}
                    <span className="font-bold text-white text-sm font-mono">
                      {svc.actualCost > 0 ? formatCurrency(svc.actualCost) : svc.status === 'COMPLETED' ? 'Free' : '—'}
                    </span>
                  </div>
                </div>

                {/* Main Content: Title & Description */}
                <div>
                  <h4 className="text-sm font-bold text-white">{svc.issueTitle}</h4>
                  {svc.issueDescription && (
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{svc.issueDescription}</p>
                  )}
                </div>

                {/* 15 Fields Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs pt-1">
                  {/* Service Provider & Center */}
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-500 block">Service Provider & Center</span>
                    <p className="text-slate-200 font-medium">
                      {svc.serviceCenterName || svc.serviceProvider || 'Authorized Support Center'}
                    </p>
                    {svc.serviceCenterAddress && (
                      <p className="text-[11px] text-slate-400">{svc.serviceCenterAddress}</p>
                    )}
                  </div>

                  {/* Dates */}
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-500 block">Timeline Dates</span>
                    <p className="text-slate-300">
                      Reported: <strong className="text-slate-200">{formatDate(svc.reportedDate)}</strong>
                    </p>
                    {svc.scheduledDate && (
                      <p className="text-slate-400 text-[11px]">Scheduled: {formatDate(svc.scheduledDate)}</p>
                    )}
                    {svc.completedDate && (
                      <p className="text-emerald-400 text-[11px]">Completed: {formatDate(svc.completedDate)}</p>
                    )}
                  </div>

                  {/* Contact & External Links */}
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-500 block">Contact & Details</span>
                    {svc.serviceCenterPhone && (
                      <a
                        href={`tel:${svc.serviceCenterPhone}`}
                        className="text-sky-400 hover:underline block text-xs"
                      >
                        📞 {svc.serviceCenterPhone}
                      </a>
                    )}
                    {svc.serviceCenterUrl && (
                      <a
                        href={svc.serviceCenterUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-400 hover:underline inline-flex items-center gap-1 text-[11px]"
                      >
                        Portal Link <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                    {svc.notes && (
                      <p className="text-[11px] text-slate-400 italic">Notes: {svc.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Attach Document Modal */}
      {isAttachOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Attach Document to Asset</h3>
              <button
                onClick={() => setIsAttachOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {attachError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {attachError}
              </div>
            )}

            <form onSubmit={handleAttachDocument} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Document Type
                </label>
                <select
                  value={attachDocType}
                  onChange={(e) => setAttachDocType(e.target.value)}
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-slate-100"
                >
                  {DOCUMENT_TYPES.map((dt) => (
                    <option key={dt} value={dt}>
                      {dt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Select File (JPG, PNG, PDF max 10MB)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setAttachFile(f);
                  }}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-500/10 file:text-sky-400 hover:file:bg-sky-500/20 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAttachOpen(false)}
                  disabled={isAttaching}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isAttaching}
                  disabled={!attachFile}
                >
                  Upload & Attach
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {isEditOpen && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Edit Product Record</h3>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {updateError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {updateError}
              </div>
            )}

            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              <Input
                label="Product Name *"
                name="productName"
                value={editForm.productName}
                onChange={handleEditChange}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Category
                  </label>
                  <select
                    name="category"
                    value={editForm.category}
                    onChange={handleEditChange}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 px-3 text-xs text-slate-100"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Status
                  </label>
                  <select
                    name="status"
                    value={editForm.status}
                    onChange={handleEditChange}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 px-3 text-xs text-slate-100"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Brand"
                  name="brand"
                  value={editForm.brand}
                  onChange={handleEditChange}
                />
                <Input
                  label="Model"
                  name="model"
                  value={editForm.model}
                  onChange={handleEditChange}
                />
              </div>

              <Input
                label="Serial Number"
                name="serialNumber"
                value={editForm.serialNumber}
                onChange={handleEditChange}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Purchase Price"
                  name="purchasePrice"
                  type="number"
                  step="0.01"
                  value={editForm.purchasePrice}
                  onChange={handleEditChange}
                />
                <Input
                  label="Purchase Date"
                  name="purchaseDate"
                  type="date"
                  value={editForm.purchaseDate}
                  onChange={handleEditChange}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Seller Name"
                  name="sellerName"
                  value={editForm.sellerName}
                  onChange={handleEditChange}
                />
                <Input
                  label="Seller Contact"
                  name="sellerContact"
                  value={editForm.sellerContact}
                  onChange={handleEditChange}
                />
              </div>

              {/* Warranty section */}
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-200">
                  <input
                    type="checkbox"
                    name="hasWarranty"
                    checked={editForm.hasWarranty}
                    onChange={handleEditChange}
                    className="rounded border-slate-700 text-sky-500"
                  />
                  <span>Has Active Warranty</span>
                </label>

                {editForm.hasWarranty && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <Input
                      label="Warranty Provider"
                      name="warrantyProvider"
                      value={editForm.warrantyProvider}
                      onChange={handleEditChange}
                    />
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Warranty Type
                      </label>
                      <select
                        name="warrantyType"
                        value={editForm.warrantyType}
                        onChange={handleEditChange}
                        className="block w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 px-3 text-xs text-slate-100"
                      >
                        {WARRANTY_TYPES.map((wt) => (
                          <option key={wt} value={wt}>
                            {wt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Input
                      label="Warranty Start Date"
                      name="warrantyStartDate"
                      type="date"
                      value={editForm.warrantyStartDate}
                      onChange={handleEditChange}
                    />
                    <Input
                      label="Warranty Expiration Date"
                      name="warrantyEndDate"
                      type="date"
                      value={editForm.warrantyEndDate}
                      onChange={handleEditChange}
                    />
                  </div>
                )}
              </div>

              {/* Return section */}
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-200">
                  <input
                    type="checkbox"
                    name="returnEligible"
                    checked={editForm.returnEligible}
                    onChange={handleEditChange}
                    className="rounded border-slate-700 text-sky-500"
                  />
                  <span>Eligible for Return / Exchange</span>
                </label>

                {editForm.returnEligible && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <Input
                      label="Return Start Date"
                      name="returnStartDate"
                      type="date"
                      value={editForm.returnStartDate}
                      onChange={handleEditChange}
                    />
                    <Input
                      label="Return Deadline Date"
                      name="returnEndDate"
                      type="date"
                      value={editForm.returnEndDate}
                      onChange={handleEditChange}
                    />
                    <div className="sm:col-span-2">
                      <Input
                        label="Return Policy Notes"
                        name="returnPolicyNotes"
                        value={editForm.returnPolicyNotes}
                        onChange={handleEditChange}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Owner Notes
                </label>
                <textarea
                  name="notes"
                  rows="2"
                  value={editForm.notes}
                  onChange={handleEditChange}
                  className="block w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 px-3 text-xs text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditOpen(false)}
                  disabled={isUpdating}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isUpdating}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteOpen && (
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
              Are you sure you want to permanently delete <strong className="text-white">{product.productName}</strong> from your ownership ledger?
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={isDeleting}
                onClick={handleDelete}
              >
                Delete Product
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Timeline Note Modal */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-400">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">
                  {noteModalMode === 'edit' ? 'Edit Timeline Note' : 'Add Note to Timeline'}
                </h3>
              </div>
              <button
                onClick={() => setIsNoteModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {noteError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {noteError}
              </div>
            )}

            <form onSubmit={handleSaveNote} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Note Title <span className="text-rose-400">*</span>
                </label>
                <Input
                  value={noteForm.title}
                  onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                  placeholder="e.g., Routine maintenance, Screen replacement"
                  required
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Event Date <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="date"
                  value={noteForm.eventDate}
                  onChange={(e) => setNoteForm({ ...noteForm, eventDate: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description / Context (Optional)
                </label>
                <textarea
                  value={noteForm.description}
                  onChange={(e) => setNoteForm({ ...noteForm, description: e.target.value })}
                  placeholder="Additional context, technician contact, service ticket #, etc."
                  rows={3}
                  maxLength={1000}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNoteModalOpen(false)}
                  disabled={noteSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={noteSubmitting}
                >
                  {noteModalMode === 'edit' ? 'Update Note' : 'Add Note'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Ownership Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Wrench className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">
                  {expenseModalMode === 'edit' ? 'Edit Ownership Expense' : 'Record Ownership Expense'}
                </h3>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {expenseError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {expenseError}
              </div>
            )}

            <form onSubmit={handleSaveExpense} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Expense Type <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={expenseForm.expenseType}
                    onChange={(e) => setExpenseForm({ ...expenseForm, expenseType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    required
                  >
                    {EXPENSE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Amount (₹) <span className="text-rose-400">*</span>
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    placeholder="e.g., 3200"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Expense Title <span className="text-rose-400">*</span>
                </label>
                <Input
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  placeholder="e.g., Battery replacement, RAM upgrade, Cleaning"
                  required
                  maxLength={120}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Expense Date <span className="text-rose-400">*</span>
                  </label>
                  <Input
                    type="date"
                    value={expenseForm.expenseDate}
                    onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Vendor / Service Center
                  </label>
                  <Input
                    value={expenseForm.vendorName}
                    onChange={(e) => setExpenseForm({ ...expenseForm, vendorName: e.target.value })}
                    placeholder="e.g., HP Authorized Center"
                    maxLength={150}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Attach Existing Document (Optional)
                </label>
                <select
                  value={expenseForm.relatedDocumentId}
                  onChange={(e) => setExpenseForm({ ...expenseForm, relatedDocumentId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- None / No document linked --</option>
                  {documents.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.fileName} ({d.documentType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description / Service Notes
                </label>
                <textarea
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="Details of parts replaced, service findings, warranty claim numbers..."
                  rows={2}
                  maxLength={1000}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsExpenseModalOpen(false)}
                  disabled={expenseSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={expenseSubmitting}
                >
                  {expenseModalMode === 'edit' ? 'Update Expense' : 'Save Expense'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary-500/10 border border-primary-500/20 rounded-xl text-primary-400">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Initiate Ownership Transfer</h3>
                  <p className="text-xs text-slate-400">Securely hand off product & receipts</p>
                </div>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {transferError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
                {transferError}
              </div>
            )}

            <form onSubmit={handleInitiateTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Recipient Email Address <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="email"
                  value={transferEmail}
                  onChange={(e) => setTransferEmail(e.target.value)}
                  placeholder="recipient@example.com"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  The recipient will receive an invitation to accept ownership of this asset.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Transfer Note / Message (Optional)
                </label>
                <textarea
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="e.g. Sold on OLX / Gift for birthday / Handed over with power brick"
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary-500"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <span className="font-semibold text-slate-300 block">Transfer Safeguards:</span>
                <p>• Product status changes to <em>Transfer Pending</em>.</p>
                <p>• Ownership changes <strong>only</strong> when the recipient confirms acceptance.</p>
                <p>• Invoices & documents linked to this product migrate to the new owner.</p>
                <p>• Your historic financial analytics and expenses remain isolated in your ledger.</p>
                <p>• You can cancel the transfer anytime before acceptance.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTransferModalOpen(false)}
                  disabled={transferSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  isLoading={transferSubmitting}
                >
                  Initiate Transfer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Service / Repair Modal (Phase 17) */}
      {isLogServiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-sky-400" />
                  Log Service or Repair: {product.productName}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Record maintenance visits, hardware repairs, and authorized service work.
                </p>
              </div>
              <button
                onClick={() => setIsLogServiceOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {serviceError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {serviceError}
              </div>
            )}

            <form onSubmit={handleCreateProductService} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Service Type *</label>
                  <select
                    value={newService.serviceType}
                    onChange={(e) => setNewService({ ...newService, serviceType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                  >
                    <option value="REPAIR">Repair</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="WARRANTY_CLAIM">Warranty Claim</option>
                    <option value="INSPECTION">Inspection / Diagnostics</option>
                    <option value="INSTALLATION">Installation</option>
                    <option value="REPLACEMENT">Replacement</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Status *</label>
                  <select
                    value={newService.status}
                    onChange={(e) => setNewService({ ...newService, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                  >
                    <option value="REQUESTED">Requested</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="IN_SERVICE">In Service</option>
                    <option value="WAITING_FOR_PARTS">Waiting for Parts</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Issue Title *</label>
                <Input
                  value={newService.issueTitle}
                  onChange={(e) => setNewService({ ...newService, issueTitle: e.target.value })}
                  placeholder="e.g., Battery replacement, Display flickering, Routine service"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Issue Description</label>
                <textarea
                  value={newService.issueDescription}
                  onChange={(e) => setNewService({ ...newService, issueDescription: e.target.value })}
                  placeholder="Details of symptoms, root cause, or diagnosis..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Service Provider / Center</label>
                  <Input
                    value={newService.serviceCenterName}
                    onChange={(e) => setNewService({ ...newService, serviceCenterName: e.target.value })}
                    placeholder="e.g., Apple Authorized Care (Inspire)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number</label>
                  <Input
                    value={newService.serviceCenterPhone}
                    onChange={(e) => setNewService({ ...newService, serviceCenterPhone: e.target.value })}
                    placeholder="e.g., 080-40994444"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Service Center Address</label>
                  <Input
                    value={newService.serviceCenterAddress}
                    onChange={(e) => setNewService({ ...newService, serviceCenterAddress: e.target.value })}
                    placeholder="e.g., Indiranagar, Bengaluru"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Portal / Tracking URL</label>
                  <Input
                    value={newService.serviceCenterUrl}
                    onChange={(e) => setNewService({ ...newService, serviceCenterUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Reported Date</label>
                  <Input
                    type="date"
                    value={newService.reportedDate}
                    onChange={(e) => setNewService({ ...newService, reportedDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Scheduled Date</label>
                  <Input
                    type="date"
                    value={newService.scheduledDate}
                    onChange={(e) => setNewService({ ...newService, scheduledDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Completed Date</label>
                  <Input
                    type="date"
                    value={newService.completedDate}
                    onChange={(e) => setNewService({ ...newService, completedDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Estimated Cost (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={newService.estimatedCost}
                    onChange={(e) => setNewService({ ...newService, estimatedCost: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Actual Cost (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={newService.actualCost}
                    onChange={(e) => setNewService({ ...newService, actualCost: e.target.value })}
                    placeholder="0 (Free if warranty covers it)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes / Parts Replaced</label>
                <Input
                  value={newService.notes}
                  onChange={(e) => setNewService({ ...newService, notes: e.target.value })}
                  placeholder="e.g., Replaced battery under warranty. 90-day parts warranty included."
                />
              </div>

              <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-300">
                ℹ️ Actual costs logged here automatically synchronize with your asset's total ownership expenses without duplication.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLogServiceOpen(false)}
                  disabled={serviceSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  isLoading={serviceSubmitting}
                >
                  Save Service Record
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetailPage;
