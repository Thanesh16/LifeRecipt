import mongoose from 'mongoose';

/**
 * LIFERECEIPT Core Product & Ownership Data Model
 * Phase 2 Production Implementation
 * 
 * Supports diverse physical product types with strict per-user ownership,
 * optional warranty tracking, and return window monitoring.
 */
const productSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for strict data ownership isolation'],
      index: true,
    },
    productName: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [150, 'Product name cannot exceed 150 characters'],
    },
    productDescription: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      required: [true, 'Product category is required'],
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
      index: true,
    },
    brand: {
      type: String,
      trim: true,
      default: '',
    },
    model: {
      type: String,
      trim: true,
      default: '',
    },
    serialNumber: {
      type: String,
      trim: true,
      default: '',
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    purchasePrice: {
      type: Number,
      default: 0,
      min: [0, 'Purchase price cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    sellerName: {
      type: String,
      trim: true,
      default: '',
    },
    sellerContact: {
      type: String,
      trim: true,
      default: '',
    },
    warranty: {
      hasWarranty: {
        type: Boolean,
        default: false,
        index: true,
      },
      warrantyStartDate: {
        type: Date,
      },
      warrantyEndDate: {
        type: Date,
        index: true,
      },
      warrantyProvider: {
        type: String,
        trim: true,
        default: '',
      },
      warrantyType: {
        type: String,
        enum: ['Manufacturer', 'Extended', 'Store', 'Third-Party', 'Lifetime', 'None', ''],
        default: 'None',
      },
    },
    returnInfo: {
      returnEligible: {
        type: Boolean,
        default: false,
        index: true,
      },
      returnStartDate: {
        type: Date,
      },
      returnEndDate: {
        type: Date,
        index: true,
      },
      returnPolicyNotes: {
        type: String,
        trim: true,
        default: '',
      },
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['Active', 'Sold', 'Disposed', 'Archived', 'In Repair', 'Transfer Pending', 'Transferred'],
      default: 'Active',
      index: true,
    },
    transferredAt: {
      type: Date,
      default: null,
      index: true,
    },
    originalPurchaseDate: {
      type: Date,
      default: null,
    },
    originalSeller: {
      type: String,
      trim: true,
      default: '',
    },
    source: {
      type: String,
      enum: ['MANUAL', 'UPLOAD', 'EMAIL', 'TRANSFER'],
      default: 'MANUAL',
      index: true,
    },
    sourceMetadata: {
      provider: { type: String, default: '' },
      emailReceiptId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailReceipt', default: null },
      importedAt: { type: Date, default: null },
    },
    externalIntelligenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductIntelligence',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for user-isolated queries, category filtering, and deadline tracking
productSchema.index({ userId: 1, createdAt: -1 });
productSchema.index({ userId: 1, category: 1 });
productSchema.index({ userId: 1, 'warranty.hasWarranty': 1, 'warranty.warrantyEndDate': 1 });
productSchema.index({ userId: 1, 'returnInfo.returnEligible': 1, 'returnInfo.returnEndDate': 1 });

// Text index for search across productName, brand, model, serialNumber, sellerName
productSchema.index({
  productName: 'text',
  brand: 'text',
  model: 'text',
  serialNumber: 'text',
  sellerName: 'text',
});

const Product = mongoose.model('Product', productSchema);

export default Product;
