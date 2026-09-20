import mongoose from 'mongoose';

/**
 * LIFERECEIPT ServiceRecord Model
 * Phase 13: Warranty & Service Ecosystem
 * 
 * Tracks repair logs, maintenance entries, warranty service claims, and inspections.
 * Enforces multi-tenant isolation, compound indexes, and automatic linkage to ownership expenses.
 */
const serviceRecordSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for service record isolation'],
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },
    serviceType: {
      type: String,
      required: [true, 'Service type is required'],
      enum: {
        values: [
          'WARRANTY_CLAIM',
          'REPAIR',
          'MAINTENANCE',
          'INSPECTION',
          'INSTALLATION',
          'REPLACEMENT',
          'OTHER',
        ],
        message: '{VALUE} is not a valid service type',
      },
      index: true,
    },
    status: {
      type: String,
      required: [true, 'Service status is required'],
      enum: {
        values: [
          'REQUESTED',
          'SCHEDULED',
          'IN_SERVICE',
          'WAITING_FOR_PARTS',
          'COMPLETED',
          'CANCELLED',
          'REJECTED',
        ],
        message: '{VALUE} is not a valid service status',
      },
      default: 'REQUESTED',
      index: true,
    },
    serviceProvider: {
      type: String,
      trim: true,
      maxlength: [150, 'Service provider cannot exceed 150 characters'],
      default: '',
    },
    serviceCenterName: {
      type: String,
      trim: true,
      maxlength: [150, 'Service center name cannot exceed 150 characters'],
      default: '',
    },
    serviceCenterAddress: {
      type: String,
      trim: true,
      maxlength: [300, 'Service center address cannot exceed 300 characters'],
      default: '',
    },
    serviceCenterPhone: {
      type: String,
      trim: true,
      maxlength: [50, 'Service center phone cannot exceed 50 characters'],
      default: '',
    },
    serviceCenterUrl: {
      type: String,
      trim: true,
      default: '',
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
    reportedDate: {
      type: Date,
      required: [true, 'Reported date is required'],
      default: Date.now,
      index: true,
    },
    scheduledDate: {
      type: Date,
      default: null,
    },
    completedDate: {
      type: Date,
      default: null,
    },
    warrantyRelated: {
      type: Boolean,
      default: false,
      index: true,
    },
    warrantyClaimReference: {
      type: String,
      trim: true,
      default: '',
    },
    estimatedCost: {
      type: Number,
      default: 0,
      min: [0, 'Estimated cost cannot be negative'],
    },
    actualCost: {
      type: Number,
      default: 0,
      min: [0, 'Actual cost cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    relatedDocumentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
      },
    ],
    relatedExpenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense',
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Notes cannot exceed 2000 characters'],
      default: '',
    },
    source: {
      type: String,
      enum: ['USER', 'MANUFACTURER', 'DOCUMENT', 'AI'],
      default: 'USER',
    },
  },
  {
    timestamps: true,
  }
);

// High-performance compound indexes for user queries & reporting
serviceRecordSchema.index({ userId: 1, productId: 1 });
serviceRecordSchema.index({ userId: 1, status: 1 });
serviceRecordSchema.index({ userId: 1, reportedDate: -1 });
serviceRecordSchema.index({ productId: 1, reportedDate: -1 });

const ServiceRecord = mongoose.model('ServiceRecord', serviceRecordSchema);

export default ServiceRecord;
