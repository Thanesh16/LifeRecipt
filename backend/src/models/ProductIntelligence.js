import mongoose from 'mongoose';

/**
 * LIFERECEIPT ProductIntelligence Model
 * Stores normalized external specifications, manuals, support URLs, and official warranty data.
 * Adheres to strict source attribution, caching TTL, and zero overwrite of user receipts.
 */
const productIntelligenceSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required for intelligence association'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for multi-tenant isolation'],
      index: true,
    },
    provider: {
      type: String,
      default: 'OFFICIAL_MANUFACTURER',
      trim: true,
    },
    sourceType: {
      type: String,
      enum: [
        'OFFICIAL_MANUFACTURER',
        'GOVERNMENT_REGULATORY',
        'TRUSTED_AUTHORITATIVE',
        'SECONDARY_REPUTABLE',
      ],
      default: 'OFFICIAL_MANUFACTURER',
      index: true,
    },
    sourceName: {
      type: String,
      required: [true, 'Source name is required'],
      trim: true,
    },
    sourceUrl: {
      type: String,
      required: [true, 'Source URL is required'],
      trim: true,
    },
    manufacturer: {
      type: String,
      trim: true,
      default: '',
    },
    model: {
      type: String,
      trim: true,
      default: '',
    },
    productName: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: '',
    },
    specifications: [
      {
        key: { type: String, required: true },
        label: { type: String, required: true },
        value: { type: String, required: true },
        group: { type: String, default: 'General' },
      },
    ],
    officialProductUrl: {
      type: String,
      trim: true,
      default: '',
    },
    supportUrl: {
      type: String,
      trim: true,
      default: '',
    },
    manualUrl: {
      type: String,
      trim: true,
      default: '',
    },
    warrantyUrl: {
      type: String,
      trim: true,
      default: '',
    },
    officialWarranty: {
      durationMonths: { type: Number, default: null },
      description: { type: String, default: '' },
      warrantyType: { type: String, default: 'Manufacturer Limited' },
    },
    serviceCenters: [
      {
        name: { type: String, default: '' },
        city: { type: String, default: '' },
        address: { type: String, default: '' },
        phone: { type: String, default: '' },
        verified: { type: Boolean, default: true },
      },
    ],
    confidence: {
      type: String,
      enum: ['HIGH', 'MEDIUM', 'LOW'],
      default: 'HIGH',
    },
    fetchedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7-day TTL
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'UNAVAILABLE', 'AMBIGUOUS'],
      default: 'ACTIVE',
      index: true,
    },
    ambiguousMatches: [
      {
        model: { type: String, default: '' },
        name: { type: String, default: '' },
        description: { type: String, default: '' },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast product cache lookup
productIntelligenceSchema.index({ productId: 1, fetchedAt: -1 });
productIntelligenceSchema.index({ productId: 1, provider: 1 });
productIntelligenceSchema.index({ userId: 1, productId: 1 });

const ProductIntelligence = mongoose.model('ProductIntelligence', productIntelligenceSchema);

export default ProductIntelligence;
