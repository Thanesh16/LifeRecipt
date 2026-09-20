import mongoose from 'mongoose';

/**
 * LIFERECEIPT SecurityAudit Model
 * Records security-sensitive operations across authentication, document vault,
 * ownership transfers, and passport sharing.
 * 
 * Strict Privacy Rule: NEVER stores raw passwords, JWT tokens, or credentials.
 */
const securityAuditSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    email: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
      index: true,
    },
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      enum: [
        'LOGIN',
        'FAILED_LOGIN',
        'REGISTER',
        'LOGOUT',
        'PASSWORD_CHANGE',
        'DOCUMENT_UPLOAD',
        'DOCUMENT_DELETE',
        'PASSPORT_SHARE_CREATE',
        'PASSPORT_SHARE_REVOKE',
        'TRANSFER_INITIATE',
        'TRANSFER_ACCEPT',
        'TRANSFER_REJECT',
        'TRANSFER_CANCEL',
        'ACCOUNT_DELETE',
        'PROFILE_UPDATE',
      ],
      index: true,
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED'],
      default: 'SUCCESS',
      index: true,
    },
    ipAddress: {
      type: String,
      default: 'unknown',
    },
    userAgent: {
      type: String,
      default: 'unknown',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for chronological querying per user
securityAuditSchema.index({ userId: 1, createdAt: -1 });

// TTL index to automatically purge audit entries after 90 days
securityAuditSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const SecurityAudit = mongoose.model('SecurityAudit', securityAuditSchema);

export default SecurityAudit;
