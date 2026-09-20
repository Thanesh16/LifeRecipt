import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Sparkles,
  Plus,
  ShieldCheck,
  RotateCcw,
  Tag,
  IndianRupee,
  Calendar,
  Building,
  Phone,
  AlertCircle,
  ArrowRight,
  UploadCloud,
  CheckCircle2,
  File,
  X,
  Loader2,
  Camera,
} from 'lucide-react';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import productService from '../services/productService';
import documentService from '../services/documentService';
import ExtractionReviewModal from '../components/documents/ExtractionReviewModal';
import ErrorBoundary from '../components/common/ErrorBoundary';

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

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD'];
const WARRANTY_TYPES = ['Manufacturer', 'Extended', 'Store', 'Third-Party', 'Lifetime', 'None'];
const STATUSES = ['Active', 'In Repair', 'Sold', 'Disposed', 'Archived'];
const DOCUMENT_TYPES = ['RECEIPT', 'INVOICE', 'WARRANTY', 'MANUAL', 'OTHER'];

export const AddPurchasePage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('ai'); // 'ai' or 'manual'

  // AI Extraction Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [docType, setDocType] = useState('RECEIPT');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [reviewData, setReviewData] = useState(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Progressive scanning stepper
  const SCAN_STAGES = [
    { label: 'Analyzing document...', hint: 'Reading binary layout and calculating file hash' },
    { label: 'Extracting text & structure...', hint: 'Parsing text layers and optical character data' },
    { label: 'Understanding document with AI...', hint: 'Extracting product name, price, brand, and warranty' },
    { label: 'Preparing extracted information...', hint: 'Validating fields and cross-checking vault records' },
  ];
  const [scanStageIndex, setScanStageIndex] = useState(0);

  useEffect(() => {
    if (!isScanning) {
      setScanStageIndex(0);
      return;
    }

    setScanStageIndex(0);
    const t1 = setTimeout(() => setScanStageIndex(1), 3000);
    const t2 = setTimeout(() => setScanStageIndex(2), 8000);
    const t3 = setTimeout(() => setScanStageIndex(3), 18000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isScanning]);

  // Manual Form State
  const [formData, setFormData] = useState({
    productName: '',
    category: 'Electronics',
    brand: '',
    model: '',
    serialNumber: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    purchasePrice: '',
    currency: 'INR',
    sellerName: '',
    sellerContact: '',
    hasWarranty: false,
    warrantyStartDate: new Date().toISOString().split('T')[0],
    warrantyEndDate: '',
    warrantyProvider: '',
    warrantyType: 'Manufacturer',
    returnEligible: false,
    returnStartDate: new Date().toISOString().split('T')[0],
    returnEndDate: '',
    returnPolicyNotes: '',
    notes: '',
    status: 'Active',
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setScanError('Unsupported file format. Please upload a JPG, JPEG, PNG, or PDF file.');
      return;
    }

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setScanError('File size exceeds the 10MB limit.');
      return;
    }

    setSelectedFile(file);
    setScanError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setScanError('Unsupported file format. Please upload a JPG, JPEG, PNG, or PDF file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setScanError('File size exceeds the 10MB limit.');
      return;
    }

    setSelectedFile(file);
    setScanError('');
  };

  const handleStartExtraction = async () => {
    if (!selectedFile || isScanning) {
      if (!selectedFile) {
        setScanError('Please select a receipt or invoice file first.');
      }
      return;
    }

    setIsScanning(true);
    setScanError('');

    try {
      const response = await documentService.uploadAndExtract(selectedFile, docType);
      if (response.success && response.data) {
        setReviewData(response.data);
        setIsReviewOpen(true);
      } else {
        throw new Error(response.message || 'Extraction failed');
      }
    } catch (err) {
      const isTimeout =
        err.code === 'ECONNABORTED' ||
        (err.message && err.message.toLowerCase().includes('timeout') && !err.response);

      const friendlyError = isTimeout
        ? 'Document processing took longer than expected. Please retry or enter details manually.'
        : (err.response?.data?.message || err.message || 'Failed to process document. Please retry or enter details manually.');

      setScanError(friendlyError);
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmExtraction = async (documentId, productData) => {
    setIsConfirming(true);
    try {
      const response = await documentService.confirmAndCreateProduct(documentId, productData);
      if (response.success && response.data?.product?._id) {
        setIsReviewOpen(false);
        navigate(`/products/${response.data.product._id}`);
      } else {
        throw new Error(response.message || 'Failed to create product');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Error confirming product record');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
    setServerError('');
  };

  const validate = () => {
    const errors = {};
    if (!formData.productName.trim()) {
      errors.productName = 'Product name is required';
    }

    if (!formData.category) {
      errors.category = 'Category is required';
    }

    if (formData.purchasePrice && Number(formData.purchasePrice) < 0) {
      errors.purchasePrice = 'Purchase price cannot be negative';
    }

    if (formData.hasWarranty && formData.warrantyEndDate && formData.warrantyStartDate) {
      if (new Date(formData.warrantyEndDate) < new Date(formData.warrantyStartDate)) {
        errors.warrantyEndDate = 'Warranty end date cannot be earlier than start date';
      }
    }

    if (formData.returnEligible && formData.returnEndDate && formData.returnStartDate) {
      if (new Date(formData.returnEndDate) < new Date(formData.returnStartDate)) {
        errors.returnEndDate = 'Return end date cannot be earlier than start date';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setServerError('');

    const payload = {
      productName: formData.productName.trim(),
      category: formData.category,
      brand: formData.brand.trim(),
      model: formData.model.trim(),
      serialNumber: formData.serialNumber.trim(),
      purchaseDate: formData.purchaseDate || undefined,
      purchasePrice: formData.purchasePrice ? Number(formData.purchasePrice) : 0,
      currency: formData.currency,
      sellerName: formData.sellerName.trim(),
      sellerContact: formData.sellerContact.trim(),
      warranty: {
        hasWarranty: formData.hasWarranty,
        warrantyStartDate: formData.hasWarranty && formData.warrantyStartDate ? formData.warrantyStartDate : undefined,
        warrantyEndDate: formData.hasWarranty && formData.warrantyEndDate ? formData.warrantyEndDate : undefined,
        warrantyProvider: formData.hasWarranty ? formData.warrantyProvider.trim() : '',
        warrantyType: formData.hasWarranty ? formData.warrantyType : 'None',
      },
      returnInfo: {
        returnEligible: formData.returnEligible,
        returnStartDate: formData.returnEligible && formData.returnStartDate ? formData.returnStartDate : undefined,
        returnEndDate: formData.returnEligible && formData.returnEndDate ? formData.returnEndDate : undefined,
        returnPolicyNotes: formData.returnEligible ? formData.returnPolicyNotes.trim() : '',
      },
      notes: formData.notes.trim(),
      status: formData.status,
    };

    try {
      const response = await productService.createProduct(payload);
      if (response.success && response.data?._id) {
        navigate(`/products/${response.data._id}`);
      } else {
        throw new Error(response.message || 'Failed to create product');
      }
    } catch (err) {
      setServerError(err.response?.data?.message || err.message || 'Error creating product record');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
          Add Purchase & Ownership Record
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Digitize receipt documents or register manual ownership details with strict user isolation.
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-xl max-w-md">
        <button
          type="button"
          onClick={() => setActiveTab('ai')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'ai'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Receipt Scanner</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('manual')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'manual'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Manual Entry Form</span>
        </button>
      </div>

      {/* TAB 1: AI RECEIPT SCANNER */}
      {activeTab === 'ai' ? (
        <div className="space-y-6">
          <Card
            title="AI-Powered Receipt & Invoice Scanner"
            subtitle="Upload physical receipt photos or PDF invoices for automated structured extraction"
          >
            {scanError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{scanError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Document Type Selector */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-300">Document Type:</span>
                <div className="flex flex-wrap gap-1.5">
                  {DOCUMENT_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDocType(type)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                        docType === type
                          ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 font-semibold'
                          : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => !isScanning && e.preventDefault()}
                onDrop={!isScanning ? handleDrop : undefined}
                onClick={() => !isScanning && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all ${
                  isScanning
                    ? 'pointer-events-none opacity-60 border-slate-800 bg-slate-950/30 cursor-not-allowed'
                    : selectedFile
                    ? 'border-sky-500/60 bg-sky-500/5 cursor-pointer'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/70 cursor-pointer'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center mx-auto">
                      <FileText className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{selectedFile.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || 'Document'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isScanning}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 font-medium disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Remove File</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto">
                      <UploadCloud className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        Click to select or drag & drop document here
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Supports high-resolution JPG, PNG photos or multi-page PDF invoices (up to 10MB)
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-3 pt-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        leftIcon={<Camera className="w-4 h-4 text-sky-400" />}
                        onClick={() => cameraInputRef.current?.click()}
                      >
                        Take Photo with Camera
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        leftIcon={<UploadCloud className="w-4 h-4 text-slate-400" />}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Browse Files
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Scanning Stepper */}
              {isScanning && (
                <div className="p-4 rounded-xl bg-slate-900/90 border border-sky-500/30 space-y-3 shadow-lg shadow-sky-950/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sky-400 font-medium text-xs">
                      <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                      <span className="font-semibold">{SCAN_STAGES[scanStageIndex].label}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Step {scanStageIndex + 1} of {SCAN_STAGES.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 pl-6">{SCAN_STAGES[scanStageIndex].hint}</p>
                  {/* Progress bar stages */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {SCAN_STAGES.map((st, idx) => (
                      <div
                        key={st.label}
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          idx < scanStageIndex
                            ? 'bg-sky-400'
                            : idx === scanStageIndex
                            ? 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.8)] animate-pulse'
                            : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Extraction Trigger */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-[11px] text-slate-400">
                  Documents are stored in your encrypted personal vault and extracted without public exposure.
                </p>

                <Button
                  variant="primary"
                  size="md"
                  onClick={handleStartExtraction}
                  disabled={!selectedFile || isScanning}
                  isLoading={isScanning}
                  leftIcon={<Sparkles className="w-4 h-4" />}
                >
                  {isScanning ? SCAN_STAGES[scanStageIndex].label : 'Scan & Extract with AI'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        /* TAB 2: MANUAL FORM */
        <form onSubmit={handleSubmit} className="space-y-6">
          {serverError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* 1. Core Identification */}
          <Card title="1. Product Identification" subtitle="Core specifications and model identification">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="Product Name *"
                  name="productName"
                  placeholder="e.g. Sony WH-1000XM5 Wireless Headphones"
                  value={formData.productName}
                  onChange={handleChange}
                  error={fieldErrors.productName}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Category *</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="block w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 px-3 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Asset Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="block w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 px-3 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  {STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <Input label="Brand" name="brand" placeholder="e.g. Sony" value={formData.brand} onChange={handleChange} />
              <Input label="Model Code" name="model" placeholder="e.g. WH1000XM5/B" value={formData.model} onChange={handleChange} />

              <div className="sm:col-span-2">
                <Input
                  label="Serial Number (Hardware Identifier)"
                  name="serialNumber"
                  placeholder="e.g. S01-7489201-E"
                  value={formData.serialNumber}
                  onChange={handleChange}
                />
              </div>
            </div>
          </Card>

          {/* 2. Purchase Details */}
          <Card title="2. Purchase & Financial Information" subtitle="Transaction date, price, and merchant credentials">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Purchase Date"
                name="purchaseDate"
                type="date"
                value={formData.purchaseDate}
                onChange={handleChange}
                leftIcon={<Calendar className="w-4 h-4" />}
              />

              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    label="Purchase Price"
                    name="purchasePrice"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="72999"
                    value={formData.purchasePrice}
                    onChange={handleChange}
                    error={fieldErrors.purchasePrice}
                    leftIcon={<IndianRupee className="w-4 h-4" />}
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Currency</label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 px-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Input label="Merchant / Seller" name="sellerName" placeholder="e.g. Best Buy #481" value={formData.sellerName} onChange={handleChange} leftIcon={<Building className="w-4 h-4" />} />
              <Input label="Seller Contact" name="sellerContact" placeholder="e.g. support@bestbuy.com" value={formData.sellerContact} onChange={handleChange} leftIcon={<Phone className="w-4 h-4" />} />
            </div>
          </Card>

          {/* 3. Warranty Information */}
          <Card title="3. Warranty Protection" subtitle="Configure duration and coverage terms">
            <div className="space-y-4">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-900 cursor-pointer">
                <input type="checkbox" name="hasWarranty" checked={formData.hasWarranty} onChange={handleChange} className="rounded border-slate-700 text-sky-500" />
                <div>
                  <p className="text-xs font-semibold text-slate-200">This product includes active warranty coverage</p>
                  <p className="text-[11px] text-slate-400">Enables proactive countdown notifications before coverage expires.</p>
                </div>
              </label>

              {formData.hasWarranty && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
                  <Input label="Warranty Provider" name="warrantyProvider" placeholder="e.g. Sony Electronics" value={formData.warrantyProvider} onChange={handleChange} />
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Warranty Type</label>
                    <select name="warrantyType" value={formData.warrantyType} onChange={handleChange} className="block w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 px-3 text-sm text-slate-100">
                      {WARRANTY_TYPES.map((wt) => (
                        <option key={wt} value={wt}>
                          {wt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input label="Warranty Start Date" name="warrantyStartDate" type="date" value={formData.warrantyStartDate} onChange={handleChange} />
                  <Input label="Warranty Expiration Date" name="warrantyEndDate" type="date" value={formData.warrantyEndDate} onChange={handleChange} error={fieldErrors.warrantyEndDate} />
                </div>
              )}
            </div>
          </Card>

          {/* 4. Return Information */}
          <Card title="4. Return Policy & Window" subtitle="Store return policies and deadline countdown">
            <div className="space-y-4">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-900 cursor-pointer">
                <input type="checkbox" name="returnEligible" checked={formData.returnEligible} onChange={handleChange} className="rounded border-slate-700 text-sky-500" />
                <div>
                  <p className="text-xs font-semibold text-slate-200">Product is eligible for return or exchange</p>
                  <p className="text-[11px] text-slate-400">Track the merchant return window so you never forfeit your right to a refund.</p>
                </div>
              </label>

              {formData.returnEligible && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
                  <Input label="Return Window Start" name="returnStartDate" type="date" value={formData.returnStartDate} onChange={handleChange} />
                  <Input label="Return Window Deadline" name="returnEndDate" type="date" value={formData.returnEndDate} onChange={handleChange} error={fieldErrors.returnEndDate} />
                  <div className="sm:col-span-2">
                    <Input label="Return Policy Notes" name="returnPolicyNotes" placeholder="e.g. 15-day window with receipt" value={formData.returnPolicyNotes} onChange={handleChange} />
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* 5. Notes */}
          <Card title="5. Additional Notes">
            <textarea
              name="notes"
              rows="3"
              placeholder="Add warranty registration codes, serial notes, or receipt storage notes..."
              value={formData.notes}
              onChange={handleChange}
              className="block w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 px-3.5 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </Card>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <Button variant="outline" size="md" onClick={() => navigate('/products')} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isSubmitting} leftIcon={<Plus className="w-4 h-4" />}>
              Register Product to Ledger
            </Button>
          </div>
        </form>
      )}

      {/* Interactive Extraction Review Modal protected by ErrorBoundary */}
      {isReviewOpen && reviewData && (
        <ErrorBoundary
          title="Document Review Display Notice"
          description="A display issue occurred while preparing the interactive review modal. You can review details or proceed with manual entry."
          fallback={({ error, resetErrorBoundary }) => (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
              <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">Document Extraction Saved</h3>
                    <p className="text-xs text-slate-400">The file was analyzed, but interactive preview encountered an error.</p>
                  </div>
                </div>
                <div className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800">
                  {error?.message || 'Unexpected display rendering error'}
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      resetErrorBoundary();
                      setIsReviewOpen(false);
                      setActiveTab('manual');
                    }}
                  >
                    Switch to Manual Entry
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      resetErrorBoundary();
                    }}
                  >
                    Retry View
                  </Button>
                </div>
              </div>
            </div>
          )}
        >
          <ExtractionReviewModal
            isOpen={isReviewOpen}
            onClose={() => setIsReviewOpen(false)}
            documentData={reviewData}
            onConfirm={handleConfirmExtraction}
            isSubmitting={isConfirming}
          />
        </ErrorBoundary>
      )}
    </div>
  );
};

export default AddPurchasePage;
