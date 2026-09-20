import mongoose from 'mongoose';

/**
 * LIFERECEIPT WarrantyClaim Model
 * Phase 13: Warranty & Service Ecosystem
 * 
 * Manages formal warranty claim workflows, preparation checklists, and verification tracking.
 */
const warrantyClaimSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for warranty claim isolation'],
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },
    serviceRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceRecord',
      default: null,
    },
    claimReference: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: [
          'DRAFT',
          'READY',
          'SUBMITTED',
          'UNDER_REVIEW',
          'APPROVED',
          'REJECTED',
          'COMPLETED',
          'CANCELLED',
        ],
        message: '{VALUE} is not a valid warranty claim status',
      },
      default: 'DRAFT',
      index: true,
    },
    issueTitle: {
      type: String,
      required: [true, 'Issue title is required'],
      trim: true,
      maxlength: [150, 'Issue title cannot exceed 150 characters'],
    },
    issueDescription: {
      type: String,
      trim: true,
      maxlength: [2000, 'Issue description cannot exceed 2000 characters'],
      default: '',
    },
    claimType: {
      type: String,
      enum: ['MANUFACTURER', 'EXTENDED_RETAILER', 'THIRD_PARTY_INSURANCE', 'OTHER'],
      default: 'MANUFACTURER',
    },
    submittedDate: {
      type: Date,
      default: null,
    },
    resolvedDate: {
      type: Date,
      default: null,
    },
    resolutionNotes: {
      type: String,
      trim: true,
      default: '',
    },
    provider: {
      type: String,
      trim: true,
      default: '',
    },
    serviceCenter: {
      type: String,
      trim: true,
      default: '',
    },
    relatedDocumentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
      },
    ],
    checklist: {
      hasSerial: { type: Boolean, default: false },
      hasInvoice: { type: Boolean, default: false },
      hasWarrantyDoc: { type: Boolean, default: false },
      hasProofOfPurchase: { type: Boolean, default: false },
      missingItems: [{ type: String }],
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

warrantyClaimSchema.index({ userId: 1, productId: 1 });
warrantyClaimSchema.index({ userId: 1, status: 1 });
warrantyClaimSchema.index({ userId: 1, submittedDate: -1 });

const WarrantyClaim = mongoose.model('WarrantyClaim', warrantyClaimSchema);

export default WarrantyClaim;
