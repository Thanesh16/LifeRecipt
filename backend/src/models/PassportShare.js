import mongoose from 'mongoose';

/**
 * LIFERECEIPT PassportShare Model
 * Phase 14: Digital Ownership Passport
 * 
 * Manages secure cryptographic share tokens, permission levels (BASIC, STANDARD, FULL),
 * view auditing, and revocation timestamps.
 */
const passportShareSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required for passport share'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    shareToken: {
      type: String,
      required: [true, 'Share token is required'],
    },
    tokenHash: {
      type: String,
      required: [true, 'Token hash is required'],
      unique: true,
      index: true,
    },
    permissionLevel: {
      type: String,
      enum: ['BASIC', 'STANDARD', 'FULL'],
      default: 'BASIC',
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    lastViewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

passportShareSchema.index({ productId: 1, revokedAt: 1 });
passportShareSchema.index({ userId: 1, createdAt: -1 });

const PassportShare = mongoose.model('PassportShare', passportShareSchema);

export default PassportShare;
