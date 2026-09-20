import mongoose from 'mongoose';

/**
 * LIFERECEIPT EmailConnection Model
 * Stores authenticated third-party email provider connections per user.
 * Access tokens and refresh tokens are encrypted at rest using AES-256-GCM.
 */
const emailConnectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for email connection isolation'],
      index: true,
    },
    provider: {
      type: String,
      enum: {
        values: ['GMAIL', 'OUTLOOK'],
        message: '{VALUE} is not a supported email provider',
      },
      required: [true, 'Email provider is required'],
      index: true,
    },
    providerAccountId: {
      type: String,
      trim: true,
      default: '',
    },
    emailAddress: {
      type: String,
      required: [true, 'Email address is required'],
      trim: true,
      lowercase: true,
    },
    scopes: [
      {
        type: String,
        trim: true,
      },
    ],
    encryptedAccessToken: {
      type: String,
      default: null,
      select: false,
    },
    encryptedRefreshToken: {
      type: String,
      default: null,
      select: false,
    },
    tokenExpiry: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['CONNECTED', 'EXPIRED', 'DISCONNECTED', 'ERROR'],
      default: 'CONNECTED',
      index: true,
    },
    errorMessage: {
      type: String,
      trim: true,
      default: '',
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
    syncSettings: {
      autoSync: {
        type: Boolean,
        default: true,
      },
      syncPeriodDays: {
        type: Number,
        default: 90,
        min: 1,
        max: 365,
      },
      syncFrequencyHours: {
        type: Number,
        default: 24,
        min: 1,
        max: 168,
      },
      autoEnrich: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for user query isolation and provider uniqueness per user
emailConnectionSchema.index({ userId: 1, provider: 1 });
emailConnectionSchema.index({ userId: 1, status: 1 });
emailConnectionSchema.index({ userId: 1, emailAddress: 1 });

// Ensure sensitive tokens are never serialized to JSON responses
emailConnectionSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.encryptedAccessToken;
  delete obj.encryptedRefreshToken;
  return obj;
};

const EmailConnection = mongoose.model('EmailConnection', emailConnectionSchema);

export default EmailConnection;
