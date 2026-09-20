import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  X,
  FileText,
  IndianRupee,
  Calendar,
  Building,
  Tag,
  RotateCcw,
  Info,
  Copy,
  Link as LinkIcon,
  HelpCircle,
} from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';
import { formatCurrency, formatDate } from '../../utils/formatters';
import documentService from '../../services/documentService';

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
const DOC_TYPES = [
  'RECEIPT',
  'INVOICE',
  'WARRANTY',
  'SERVICE_INVOICE',
  'INSURANCE',
  'MANUAL',
  'PURCHASE_ORDER',
  'DELIVERY_DOCUMENT',
  'OTHER',
];

export const ExtractionReviewModal = ({
  isOpen,
  onClose,
  documentData,
  onConfirm,
  isSubmitting = false,
}) => {
  if (!isOpen || !documentData) return null;

  const docRecord = documentData.document || documentData || {};
  const classification = documentData.classification || docRecord.classification || {};
  const aiProviderConfigured = documentData.aiProviderConfigured;
  const aiProvider = documentData.aiProvider;
  const statusMessage = documentData.statusMessage;
  const extractedData = documentData.extractedData || docRecord.extractedData || {};
  const matchedProduct = documentData.matchedProduct || docRecord.matchedProduct || {};
  const duplicateWarning = documentData.duplicateWarning || docRecord.duplicateWarning || {};
  const conflicts = documentData.conflicts || docRecord.conflicts || [];
  const missingFields = documentData.missingFields || docRecord.missingFields || [];
  const fieldConfidence = documentData.fieldConfidence || docRecord.fieldConfidence || {};

  const confidence = extractedData.confidence || {};

  const [isEditing, setIsEditing] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState(
    classification.detectedType || docRecord.documentType || 'RECEIPT'
  );
  const [saveAction, setSaveAction] = useState(
    matchedProduct?.matchType === 'EXACT' ? 'LINK' : 'CREATE'
  );
  const paginationRegex = /^(--\s*\d+\s*(?:of|\/)\s*\d+\s*--|page\s*\d+\s*(?:of|\/)\s*\d+|\d+\s*of\s*\d+)$/i;

  const sanitizeProductName = (raw) => {
    if (!raw || typeof raw !== 'string') return '';
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    const addressLineRegex = /(?:godown|shivam estate|place of origin|destination|shipped|billed|consignor|consignee|registration no|surat|nagercoil|tamil nadu|gujarat|pincode|industrial|logistic park)/i;
    const nonProductHeaders = /^(tax\s+invoice|invoice|receipt|bill\s+of\s+supply|order\s+details|cash\s+receipt|shipping\s+slip|delivery\s+challan|date|seller|total|amount|customer|page|original|duplicate|triplicate|declaration|ordered through|authorized)/i;

    let chosen = '';
    for (const l of lines) {
      if (!paginationRegex.test(l) && !nonProductHeaders.test(l) && !addressLineRegex.test(l) && l.length >= 3) {
        chosen = l;
        break;
      }
    }
    if (!chosen && lines.length > 0) chosen = lines[lines.length - 1];
    if (!chosen) return '';

    return chosen
      .split('|')[0]
      .replace(/\[\[\s*\]\]/g, '')
      .replace(/IMEI.*$/i, '')
      .replace(/HSN:.*$/i, '')
      .replace(/\(\d+\)$/, '')
      .replace(/^[-\s:,]+|[-\s:,]+$/g, '')
      .trim();
  };

  const rawExtractedName = (typeof extractedData.productName === 'string') ? extractedData.productName.trim() : '';
  const cleanExtractedName = sanitizeProductName(rawExtractedName);

  const rawDocFileName = (typeof docRecord.fileName === 'string')
    ? docRecord.fileName
    : (typeof docRecord.originalName === 'string')
    ? docRecord.originalName
    : '';
  const cleanFileName = rawDocFileName
    ? rawDocFileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim()
    : '';
  const fallbackFileName = (cleanFileName && !paginationRegex.test(cleanFileName)) ? cleanFileName : '';
  const initialProductName = cleanExtractedName || fallbackFileName || '';

  const [formData, setFormData] = useState({
    productName: initialProductName,
    productDescription: extractedData.productDescription || '',
    category: extractedData.category || 'Electronics',
    brand: extractedData.brand || '',
    model: extractedData.model || '',
    serialNumber: extractedData.serialNumber || '',
    purchasePrice: extractedData.purchasePrice !== null && extractedData.purchasePrice !== undefined ? extractedData.purchasePrice : '',
    currency: extractedData.currency || 'INR',
    purchaseDate: extractedData.purchaseDate || new Date().toISOString().split('T')[0],
    sellerName: extractedData.sellerName || '',
    sellerContact: extractedData.sellerPhone || '',
    invoiceNumber: extractedData.invoiceNumber || '',
    hasWarranty: Boolean(extractedData.warranty?.hasWarranty || extractedData.warranty?.durationMonths),
    warrantyProvider: extractedData.warranty?.warrantyProvider || (extractedData.brand ? `${extractedData.brand} India` : ''),
    warrantyType: extractedData.warranty?.warrantyType || 'Manufacturer',
    warrantyStartDate: extractedData.warranty?.warrantyStartDate || extractedData.purchaseDate || new Date().toISOString().split('T')[0],
    warrantyEndDate: extractedData.warranty?.warrantyEndDate || '',
    returnEligible: Boolean(extractedData.returnInfo?.returnEligible),
    returnStartDate: extractedData.purchaseDate || new Date().toISOString().split('T')[0],
    returnEndDate: extractedData.returnInfo?.returnEndDate || '',
    returnPolicyNotes: extractedData.returnInfo?.returnPolicyNotes || '',
    notes: extractedData.summary || '',
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const documentId = docRecord._id || documentData._id || documentData.documentId;

  const handleDocTypeChange = async (newType) => {
    setSelectedDocType(newType);
    if (!documentId) return;
    setIsReprocessing(true);
    try {
      const res = await documentService.reprocessDocument(documentId, newType);
      if (res.success && res.data) {
        const updated = res.data.extractedData || {};
        setFormData((prev) => ({
          ...prev,
          productName: updated.productName || prev.productName,
          brand: updated.brand || prev.brand,
          model: updated.model || prev.model,
          serialNumber: updated.serialNumber || prev.serialNumber,
          purchasePrice: updated.purchasePrice !== null && updated.purchasePrice !== undefined ? updated.purchasePrice : prev.purchasePrice,
        }));
      }
    } catch (err) {
      console.warn('[Reprocess Notice]', err.message);
    } finally {
      setIsReprocessing(false);
    }
  };

  const getConfidenceBadge = (level) => {
    if (!level || level === 'Unknown' || level === 'undefined') {
      return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
          Not in Doc
        </span>
      );
    }
    const num = parseFloat(level);
    if (level === 'High' || num >= 0.85) {
      return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          High Confidence
        </span>
      );
    }
    if (level === 'Medium' || num >= 0.60) {
      return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Medium Confidence
        </span>
      );
    }
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
        Needs Review
      </span>
    );
  };

  const handleSave = async () => {
    if (saveAction === 'LINK' && matchedProduct?.productId) {
      try {
        if (documentId) {
          await documentService.linkProduct(documentId, matchedProduct.productId);
        }
        onClose();
        return;
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to link document');
        return;
      }
    }

    if (!formData.productName.trim()) {
      alert('Product name is required.');
      return;
    }

    const payload = {
      productName: formData.productName.trim(),
      productDescription: formData.productDescription?.trim() || undefined,
      category: formData.category,
      brand: formData.brand.trim(),
      model: formData.model.trim(),
      serialNumber: formData.serialNumber.trim(),
      purchasePrice: Number(formData.purchasePrice) || 0,
      currency: formData.currency || 'INR',
      purchaseDate: formData.purchaseDate || undefined,
      sellerName: formData.sellerName.trim(),
      sellerContact: formData.sellerContact.trim(),
      invoiceNumber: formData.invoiceNumber.trim(),
      documentType: selectedDocType,
      warranty: {
        hasWarranty: formData.hasWarranty,
        warrantyProvider: formData.warrantyProvider.trim(),
        warrantyType: formData.warrantyType,
        warrantyStartDate: formData.hasWarranty && formData.warrantyStartDate ? formData.warrantyStartDate : undefined,
        warrantyEndDate: formData.hasWarranty && formData.warrantyEndDate ? formData.warrantyEndDate : undefined,
      },
      returnInfo: {
        returnEligible: formData.returnEligible,
        returnStartDate: formData.returnEligible && formData.returnStartDate ? formData.returnStartDate : undefined,
        returnEndDate: formData.returnEligible && formData.returnEndDate ? formData.returnEndDate : undefined,
        returnPolicyNotes: formData.returnPolicyNotes.trim(),
      },
      notes: formData.notes.trim(),
      status: 'Active',
    };

    onConfirm(documentId, payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                AI Document Intelligence Review
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 font-mono">
                  {docRecord?.fileName || rawDocFileName || 'Document'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Grounded extraction with multi-page OCR and zero-hallucination verification.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Classification & Page Count Pill */}
          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Objective AI Document Classification Badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs">
                <span className="text-slate-400">AI Classification:</span>
                <span className="font-semibold text-sky-400 font-mono">
                  {classification?.detectedType?.replace('_', ' ') || 'RECEIPT'}
                </span>
                {classification?.confidence && (
                  <span className="text-[11px] font-mono text-sky-300/80">
                    ({Math.round(classification.confidence * 100)}% match)
                  </span>
                )}
              </div>

              {/* User-Selected Assigned Document Type Dropdown */}
              <div className="flex items-center gap-2">
                <label htmlFor="assignedDocType" className="text-xs text-slate-400 font-medium">
                  Assigned Type:
                </label>
                <select
                  id="assignedDocType"
                  value={selectedDocType}
                  onChange={(e) => handleDocTypeChange(e.target.value)}
                  disabled={isReprocessing}
                  className="bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-sky-500"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 font-mono">
                {docRecord?.pageCount || 1} {(docRecord?.pageCount || 1) > 1 ? 'pages' : 'page'}
              </span>
              {isReprocessing && (
                <span className="text-sky-400 text-xs animate-pulse">Reprocessing...</span>
              )}
            </div>
          </div>

          {/* Duplicate Document Warning Banner */}
          {duplicateWarning?.isDuplicate && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2.5">
              <Copy className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block text-amber-300">Likely Duplicate Document</strong>
                <p className="mt-0.5 text-amber-200/90">{duplicateWarning.duplicateReason}</p>
              </div>
            </div>
          )}

          {/* Cross-Document Conflicts Warning Banner */}
          {conflicts?.length > 0 && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="w-full">
                <strong className="font-semibold block text-rose-300">Information Conflict Detected</strong>
                <ul className="mt-1 space-y-1 text-rose-200/90">
                  {conflicts.map((c, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span>•</span>
                      <span>{c.explanation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Missing Important Fields Advisory Banner */}
          {missingFields?.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-200 block mb-0.5">Missing Document Details:</span>
                <p className="text-[11px] text-slate-400">
                  The uploaded file did not contain explicit values for: {missingFields.join(', ')}. Zero hallucination rule applied. You can input them manually below.
                </p>
              </div>
            </div>
          )}

          {/* Matched Product Suggestion */}
          {matchedProduct?.productId && (
            <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-200 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sky-300">
                <LinkIcon className="w-4 h-4" />
                <span>Existing Product Match Detected</span>
              </div>
              <p className="text-sky-200/90">
                This document matches your existing product <strong>"{matchedProduct.candidateProducts?.[0]?.productName || 'Registered Product'}"</strong> ({matchedProduct.matchReason}).
              </p>
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer text-white">
                  <input
                    type="radio"
                    name="saveAction"
                    value="LINK"
                    checked={saveAction === 'LINK'}
                    onChange={() => setSaveAction('LINK')}
                    className="text-sky-500"
                  />
                  <span>Attach document to this product</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="radio"
                    name="saveAction"
                    value="CREATE"
                    checked={saveAction === 'CREATE'}
                    onChange={() => setSaveAction('CREATE')}
                    className="text-sky-500"
                  />
                  <span>Create as a new separate product</span>
                </label>
              </div>
            </div>
          )}

          {/* Summary / Mode Switch Bar */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-xs text-slate-300">
              Mode: <strong className="text-white">{isEditing ? 'Interactive Editing' : 'Summary Review'}</strong>
            </span>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Switch to Summary' : 'Edit Extracted Fields'}</span>
            </button>
          </div>

          {!isEditing ? (
            /* READ-ONLY STRUCTURED SUMMARY WITH CONFIDENCE BADGES */
            <div className="space-y-4">
              {/* Multiple Products Selector if detected */}
              {extractedData.products && Array.isArray(extractedData.products) && extractedData.products.length > 1 && (
                <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                      {extractedData.products.length} Products / Variants Detected in Document
                    </span>
                    <span className="text-[10px] text-slate-400">Click to switch primary catalog item</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {extractedData.products.map((prod, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            productName: prod.productName || prev.productName,
                            brand: prod.brand || prev.brand,
                            model: prod.model || prev.model,
                            purchasePrice: prod.purchasePrice !== null && prod.purchasePrice !== undefined ? prod.purchasePrice : prev.purchasePrice,
                            productDescription: prod.productDescription || prev.productDescription,
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all text-left ${
                          formData.productName === prod.productName
                            ? 'bg-sky-500 text-slate-950 font-bold border-sky-400 shadow-sm shadow-sky-500/20'
                            : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:border-sky-500/50'
                        }`}
                      >
                        {prod.productName}
                        {prod.purchasePrice ? ` • ${formatCurrency(prod.purchasePrice)}` : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Product Name & Description */}
                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-400 uppercase font-medium">Product Name</span>
                    {getConfidenceBadge(fieldConfidence.productName?.confidence || confidence.productName)}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white block">
                      {formData.productName && !paginationRegex.test(formData.productName) ? (
                        formData.productName
                      ) : (
                        <span className="text-slate-500 italic">Not identified in document</span>
                      )}
                    </span>
                    {formData.productDescription && (
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed" title={formData.productDescription}>
                        {formData.productDescription}
                      </p>
                    )}
                  </div>
                </div>

                {/* Category */}
                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between">
                  <span className="text-[11px] text-slate-400 uppercase font-medium mb-1">Category</span>
                  <span className="text-sm font-semibold text-sky-400">
                    {formData.category}
                  </span>
                </div>

                {/* Brand & Model */}
                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-400 uppercase font-medium">Brand & Model</span>
                    {getConfidenceBadge(fieldConfidence.brand?.confidence || confidence.brand)}
                  </div>
                  <span className="text-sm font-semibold text-slate-200">
                    {formData.brand || 'Unknown'} {formData.model && `• ${formData.model}`}
                  </span>
                </div>

                {/* Purchase Price */}
                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-400 uppercase font-medium">Purchase Price</span>
                    {getConfidenceBadge(fieldConfidence.purchasePrice?.confidence || confidence.purchasePrice)}
                  </div>
                  <span className="text-base font-bold text-emerald-400 flex items-center gap-1">
                    {formData.purchasePrice !== null && formData.purchasePrice !== undefined && formData.purchasePrice !== '' && !isNaN(Number(formData.purchasePrice)) && Number(formData.purchasePrice) > 0
                      ? formatCurrency(formData.purchasePrice, formData.currency || 'INR')
                      : <span className="text-slate-400 italic text-sm">Not in document</span>}
                  </span>
                </div>

                {/* Serial Number */}
                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-400 uppercase font-medium">Serial Number (S/N)</span>
                    {getConfidenceBadge(fieldConfidence.serialNumber?.confidence || confidence.serialNumber)}
                  </div>
                  <span className="text-sm font-mono text-slate-200">
                    {formData.serialNumber || <span className="text-slate-500 italic font-sans text-xs">Not in Document</span>}
                  </span>
                </div>

                {/* Purchase Date */}
                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-400 uppercase font-medium">Purchase Date</span>
                    {getConfidenceBadge(fieldConfidence.purchaseDate?.confidence || confidence.purchaseDate)}
                  </div>
                  <span className="text-sm text-slate-200">
                    {formData.purchaseDate ? formatDate(formData.purchaseDate) : <span className="text-slate-500 italic text-xs">Not in Document</span>}
                  </span>
                </div>

                {/* Seller & Invoice Number */}
                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-400 uppercase font-medium">Seller & Invoice #</span>
                    {getConfidenceBadge(fieldConfidence.sellerName?.confidence || confidence.sellerName)}
                  </div>
                  <span className="text-sm text-slate-200">
                    {formData.sellerName || 'Direct'}{formData.invoiceNumber ? ` • #${formData.invoiceNumber}` : ''}
                  </span>
                </div>

                {/* GST / Tax Info */}
                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-400 uppercase font-medium">GST & Taxes</span>
                    {getConfidenceBadge(fieldConfidence.gstin?.confidence || (extractedData.gstin ? 'High' : 'Unknown'))}
                  </div>
                  <span className="text-xs font-mono text-slate-200">
                    {extractedData.gstin ? `GSTIN: ${extractedData.gstin}` : (extractedData.taxInfo || 'Standard Tax')}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* EDITABLE FORM */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Input
                    label="Product Name *"
                    name="productName"
                    value={formData.productName}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    label="Product Description / Specification"
                    name="productDescription"
                    value={formData.productDescription}
                    onChange={handleChange}
                    placeholder="Full product title, specs, color variant..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Brand"
                  name="brand"
                  value={formData.brand}
                  onChange={handleChange}
                />
                <Input
                  label="Model"
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                />
                <Input
                  label="Serial Number (S/N)"
                  name="serialNumber"
                  value={formData.serialNumber}
                  onChange={handleChange}
                />
                <Input
                  label="Purchase Price (₹)"
                  name="purchasePrice"
                  type="number"
                  value={formData.purchasePrice}
                  onChange={handleChange}
                />
                <Input
                  label="Purchase Date"
                  name="purchaseDate"
                  type="date"
                  value={formData.purchaseDate}
                  onChange={handleChange}
                />
                <Input
                  label="Invoice Number"
                  name="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={handleChange}
                />
                <Input
                  label="Merchant / Seller"
                  name="sellerName"
                  value={formData.sellerName}
                  onChange={handleChange}
                />
                <Input
                  label="Seller Phone / Contact"
                  name="sellerContact"
                  value={formData.sellerContact}
                  onChange={handleChange}
                />
              </div>

              {/* Warranty section */}
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-200">
                  <input
                    type="checkbox"
                    name="hasWarranty"
                    checked={formData.hasWarranty}
                    onChange={handleChange}
                    className="rounded border-slate-700 text-sky-500"
                  />
                  <span>Has Active Warranty</span>
                </label>

                {formData.hasWarranty && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <Input
                      label="Warranty Provider"
                      name="warrantyProvider"
                      value={formData.warrantyProvider}
                      onChange={handleChange}
                    />
                    <Input
                      label="Warranty End Date"
                      name="warrantyEndDate"
                      type="date"
                      value={formData.warrantyEndDate}
                      onChange={handleChange}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <Button
                variant="secondary"
                size="md"
                onClick={() => setIsEditing(true)}
                leftIcon={<Edit3 className="w-4 h-4" />}
                disabled={isSubmitting}
              >
                Edit
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="md"
                onClick={() => setIsEditing(false)}
                disabled={isSubmitting}
              >
                Done Editing
              </Button>
            )}

            <Button
              variant="primary"
              size="md"
              onClick={handleSave}
              isLoading={isSubmitting}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              {saveAction === 'LINK' ? 'Attach to Matched Product' : 'Confirm & Save Product'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExtractionReviewModal;
