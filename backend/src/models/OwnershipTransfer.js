import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * LIFERECEIPT Ownership Transfer Model
 * Phase 10 Production Implementation
 * 
 * Manages verifiable, multi-step ownership transfers of registered physical assets
 * between LifeReceipt accounts with configurable expiration and secure audit trails.
 */
const ownershipTransferSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required for transfer'],
      index: true,
    },
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Transfer initiator ID is required'],
      index: true,
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    recipientEmail: {
      type: String,
      required: [true, 'Recipient email is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
      default: 'PENDING',
      index: true,
    },
    initiatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default: 7 days
      index: true,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    transferToken: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomBytes(24).toString('hex'),
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Transfer notes cannot exceed 500 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// High-performance compound indexes for transfer queries
ownershipTransferSchema.index({ recipientEmail: 1, status: 1 });
ownershipTransferSchema.index({ fromUserId: 1, status: 1 });
ownershipTransferSchema.index({ productId: 1, status: 1 });
ownershipTransferSchema.index({ status: 1, expiresAt: 1 });

const OwnershipTransfer = mongoose.model('OwnershipTransfer', ownershipTransferSchema);

export default OwnershipTransfer;
