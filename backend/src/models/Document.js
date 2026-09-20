import mongoose from 'mongoose';

/**
 * LIFERECEIPT Document Model
 * Secure storage and metadata for receipts, invoices, warranty cards, manuals, etc.
 * Strictly scoped per authenticated user.
 * 
 * Phase 16 Upgrades:
 * - Extended document classifications (PURCHASE_ORDER, DELIVERY_DOCUMENT, UNKNOWN, NEEDS_REVIEW)
 * - Multi-page page-level text extraction
 * - SHA-256 file hashing for duplicate document detection
 * - Field-level confidence scoring and source attribution (e.g. Page 1)
 * - Missing fields tracking and cross-document conflict detection
 * - Intelligent document-to-product matching
 */
const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for document isolation'],
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
      index: true,
    },
    documentType: {
      type: String,
      enum: [
        'RECEIPT',
        'INVOICE',
        'WARRANTY',
        'SERVICE_INVOICE',
        'INSURANCE',
        'MANUAL',
        'PURCHASE_ORDER',
        'DELIVERY_DOCUMENT',
        'OTHER',
        'UNKNOWN',
        'NEEDS_REVIEW',
      ],
      default: 'RECEIPT',
      index: true,
    },
    source: {
      type: String,
      enum: ['UPLOAD', 'EMAIL', 'MANUAL'],
      default: 'UPLOAD',
      index: true,
    },
    emailReceiptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailReceipt',
      default: null,
      index: true,
    },
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
    },
    storagePath: {
      type: String,
      required: [true, 'Storage path is required'],
    },
    fileSize: {
      type: Number,
      required: [true, 'File size is required'],
      min: [0, 'File size cannot be negative'],
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
      enum: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'],
    },
    fileHash: {
      type: String,
      default: null,
      index: true,
    },
    pageCount: {
      type: Number,
      default: 1,
    },
    pages: [
      {
        pageNumber: { type: Number, required: true },
        text: { type: String, default: '' },
      },
    ],
    ocrText: {
      type: String,
      default: '',
    },
    classification: {
      detectedType: { type: String, default: 'RECEIPT' },
      confidence: { type: Number, default: 1.0 },
      isConfident: { type: Boolean, default: true },
      alternativeTypes: [{ type: String }],
      classifiedAt: { type: Date, default: Date.now },
    },
    extractedData: {
      productName: { type: String, default: null },
      productDescription: { type: String, default: null },
      products: [{ type: mongoose.Schema.Types.Mixed }],
      category: { type: String, default: null },
      brand: { type: String, default: null },
      model: { type: String, default: null },
      serialNumber: { type: String, default: null },
      purchaseDate: { type: String, default: null },
      purchasePrice: { type: Number, default: null },
      currency: { type: String, default: 'INR' },
      sellerName: { type: String, default: null },
      sellerAddress: { type: String, default: null },
      sellerPhone: { type: String, default: null },
      invoiceNumber: { type: String, default: null },
      quantity: { type: Number, default: 1 },
      subtotal: { type: Number, default: null },
      discount: { type: Number, default: null },
      tax: { type: Number, default: null },
      totalAmount: { type: Number, default: null },
      gstin: { type: String, default: null },
      cgst: { type: Number, default: null },
      sgst: { type: Number, default: null },
      igst: { type: Number, default: null },
      paymentMethod: { type: String, default: null },
      taxInfo: { type: String, default: null },
      warranty: {
        hasWarranty: { type: Boolean, default: false },
        durationMonths: { type: Number, default: null },
        warrantyStartDate: { type: String, default: null },
        warrantyEndDate: { type: String, default: null },
        warrantyProvider: { type: String, default: null },
        warrantyType: { type: String, default: null },
        warrantyTerms: { type: String, default: null },
        exclusions: [{ type: String }],
        claimProcedure: { type: String, default: null },
        supportContact: { type: String, default: null },
        serviceCenterInformation: { type: String, default: null },
      },
      serviceInvoice: {
        serviceProvider: { type: String, default: null },
        serviceCenter: { type: String, default: null },
        serviceDate: { type: String, default: null },
        issue: { type: String, default: null },
        serviceType: { type: String, default: null },
        partsCost: { type: Number, default: null },
        laborCost: { type: Number, default: null },
        warrantyClaimReference: { type: String, default: null },
      },
      insurance: {
        insuredProduct: { type: String, default: null },
        insurer: { type: String, default: null },
        policyNumber: { type: String, default: null },
        startDate: { type: String, default: null },
        endDate: { type: String, default: null },
        coverage: { type: String, default: null },
        premium: { type: Number, default: null },
        claimContact: { type: String, default: null },
      },
      manual: {
        modelNumber: { type: String, default: null },
        installation: { type: String, default: null },
        maintenance: { type: String, default: null },
        safety: { type: String, default: null },
        supportUrl: { type: String, default: null },
      },
      confidence: {
        type: Map,
        of: String,
        default: {},
      },
      summary: { type: String, default: '' },
      unclearDetails: [{ type: String }],
    },
    fieldConfidence: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    missingFields: [{ type: String }],
    conflicts: [
      {
        field: { type: String, required: true },
        documentValue: { type: mongoose.Schema.Types.Mixed },
        existingValue: { type: mongoose.Schema.Types.Mixed },
        existingSource: { type: String, default: 'PRODUCT_RECORD' },
        explanation: { type: String, default: '' },
      },
    ],
    matchedProduct: {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
      confidence: { type: Number, default: 0 },
      matchReason: { type: String, default: '' },
      matchType: { type: String, enum: ['EXACT', 'MULTIPLE', 'NONE'], default: 'NONE' },
      candidateProducts: [
        {
          productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
          productName: { type: String },
          score: { type: Number },
          reason: { type: String },
        },
      ],
    },
    duplicateWarning: {
      isDuplicate: { type: Boolean, default: false },
      originalDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
      duplicateReason: { type: String, default: null },
    },
    aiModelUsed: {
      type: String,
      default: 'none',
    },
    status: {
      type: String,
      enum: [
        'UPLOADED',
        'PROCESSING',
        'OCR_COMPLETED',
        'EXTRACTING',
        'REVIEW_REQUIRED',
        'CONFIRMED',
        'FAILED',
        // Retain backward compatibility
        'PENDING',
        'PROCESSED',
      ],
      default: 'REVIEW_REQUIRED',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for user-isolated queries and type filtering
documentSchema.index({ userId: 1, createdAt: -1 });
documentSchema.index({ userId: 1, productId: 1 });
documentSchema.index({ userId: 1, documentType: 1 });
documentSchema.index({ userId: 1, fileHash: 1 });

const Document = mongoose.model('Document', documentSchema);

export default Document;
