import mongoose from 'mongoose';

/**
 * LIFERECEIPT Alert Model
 * Phase 4 Implementation
 * 
 * Tracks intelligent notifications for warranties, returns, and future lifecycle events.
 * Strict per-user data isolation and indexed for fast retrieval & idempotency checks.
 */
const alertSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for alert isolation'],
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Alert type is required'],
      enum: [
        'WARRANTY_EXPIRING',
        'WARRANTY_EXPIRED',
        'RETURN_EXPIRING',
        'RETURN_EXPIRED',
        'MAINTENANCE',
        'SERVICE',
        'INSURANCE',
        'OWNERSHIP_TRANSFER',
        'DOCUMENTS',
        'LIFECYCLE_EVENT',
        'WARRANTY_CLAIM',
        'PASSPORT',
        'OTHER',
      ],
      index: true,
    },
    serviceRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceRecord',
      default: null,
    },
    title: {
      type: String,
      required: [true, 'Alert title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Alert message is required'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    priority: {
      type: String,
      enum: ['HIGH', 'MEDIUM', 'LOW', 'INFO'],
      default: 'INFO',
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    relevantDate: {
      type: Date,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for performant querying and idempotency checking
alertSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
alertSchema.index({ userId: 1, type: 1, productId: 1, isRead: 1 });
alertSchema.index({ userId: 1, priority: 1 });

const Alert = mongoose.model('Alert', alertSchema);

export default Alert;
