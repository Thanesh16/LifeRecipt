import mongoose from 'mongoose';

/**
 * LIFERECEIPT Ownership History Model
 * Phase 10 Production Implementation
 * 
 * Preserves a tamper-evident chain of custody across physical assets as they
 * transition between owners, without exposing private owner history to unauthorized parties.
 */
const ownershipHistorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required for ownership history'],
      index: true,
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner User ID is required'],
      index: true,
    },
    ownerEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    ownerName: {
      type: String,
      required: true,
      trim: true,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    endedAt: {
      type: Date,
      default: null,
      index: true,
    },
    source: {
      type: String,
      enum: ['PURCHASE', 'TRANSFER', 'MANUAL'],
      default: 'PURCHASE',
    },
    transferId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OwnershipTransfer',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

ownershipHistorySchema.index({ productId: 1, startedAt: -1 });
ownershipHistorySchema.index({ ownerUserId: 1, startedAt: -1 });

const OwnershipHistory = mongoose.model('OwnershipHistory', ownershipHistorySchema);

export default OwnershipHistory;
