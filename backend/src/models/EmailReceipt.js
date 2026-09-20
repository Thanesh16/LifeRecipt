import mongoose from 'mongoose';

/**
 * LIFERECEIPT EmailReceipt Model
 * Tracks purchase candidates discovered from connected email inboxes.
 * Enforces duplicate detection, Indian GST/currency support, and strict user review before product creation.
 */
const emailReceiptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for candidate isolation'],
      index: true,
    },
    emailConnectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailConnection',
      required: [true, 'EmailConnection ID is required'],
      index: true,
    },
    provider: {
      type: String,
      enum: ['GMAIL', 'OUTLOOK'],
      default: 'GMAIL',
      index: true,
    },
    providerMessageId: {
      type: String,
      required: [true, 'Provider message ID is required'],
      trim: true,
      index: true,
    },
    threadId: {
      type: String,
      trim: true,
      default: '',
    },
    sender: {
      type: String,
      trim: true,
      default: '',
    },
    senderEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    subject: {
      type: String,
      trim: true,
      default: '',
    },
    receivedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    snippet: {
      type: String,
      trim: true,
      maxlength: [500, 'Snippet cannot exceed 500 characters'],
      default: '',
    },
    attachmentMetadata: [
      {
        attachmentId: { type: String, default: '' },
        fileName: { type: String, required: true },
        mimeType: { type: String, required: true },
        fileSize: { type: Number, default: 0 },
        storagePath: { type: String, default: '' },
        fileHash: { type: String, default: '' },
      },
    ],
    extractionStatus: {
      type: String,
      enum: [
        'DISCOVERED',
        'PROCESSING',
        'EXTRACTED',
        'REVIEW_REQUIRED',
        'CONFIRMED',
        'REJECTED',
        'DUPLICATE',
        'FAILED',
      ],
      default: 'REVIEW_REQUIRED',
      index: true,
    },
    confidence: {
      type: String,
      enum: ['HIGH', 'MEDIUM', 'LOW'],
      default: 'MEDIUM',
    },
    confidenceScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },
    duplicateStatus: {
      type: String,
      enum: ['NONE', 'EXACT_DUPLICATE', 'POSSIBLE_DUPLICATE'],
      default: 'NONE',
      index: true,
    },
    duplicateReason: {
      type: String,
      trim: true,
      default: '',
    },
    sourceConflict: {
      hasConflict: { type: Boolean, default: false },
      conflictType: { type: String, default: '' },
      emailIndicates: { type: String, default: '' },
      attachmentIndicates: { type: String, default: '' },
      conflictReason: { type: String, default: '' },
    },
    existingMatch: {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        default: null,
      },
      productName: { type: String, default: '' },
      purchasePrice: { type: Number, default: null },
      purchaseDate: { type: Date, default: null },
      invoiceNumber: { type: String, default: '' },
    },
    extractedProduct: {
      productName: { type: String, trim: true, default: '' },
      category: {
        type: String,
        enum: [
          'Electronics',
          'Appliances',
          'Automotive',
          'Home & Furniture',
          'Computing',
          'Personal & Apparel',
          'Tools & Hardware',
          'Sports & Outdoors',
          'Other',
        ],
        default: 'Other',
      },
      brand: { type: String, trim: true, default: '' },
      model: { type: String, trim: true, default: '' },
      serialNumber: { type: String, trim: true, default: '' },
      purchaseDate: { type: Date, default: null },
      purchasePrice: { type: Number, default: 0 },
      currency: { type: String, default: 'INR' },
      sellerName: { type: String, trim: true, default: '' },
      invoiceNumber: { type: String, trim: true, default: '' },
      taxInfo: { type: String, trim: true, default: '' },
      warranty: {
        hasWarranty: { type: Boolean, default: false },
        durationMonths: { type: Number, default: null },
        warrantyProvider: { type: String, default: '' },
      },
      returnInfo: {
        returnEligible: { type: Boolean, default: false },
        returnEndDate: { type: Date, default: null },
      },
    },
    linkedProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
      index: true,
    },
    linkedDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      default: null,
      index: true,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    errorMessage: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for optimal inbox filtering and duplicate identification
emailReceiptSchema.index({ userId: 1, extractionStatus: 1 });
emailReceiptSchema.index({ userId: 1, providerMessageId: 1 });
emailReceiptSchema.index({ userId: 1, duplicateStatus: 1 });
emailReceiptSchema.index({ userId: 1, receivedAt: -1 });
emailReceiptSchema.index({ userId: 1, 'extractedProduct.invoiceNumber': 1 });

const EmailReceipt = mongoose.model('EmailReceipt', emailReceiptSchema);

export default EmailReceipt;
