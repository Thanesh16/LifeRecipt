import mongoose from 'mongoose';

/**
 * LIFERECEIPT Ownership Expense Model
 * Combined Phase 7 & Phase 8 Production Implementation
 * 
 * Supports physical asset ownership expenses (repairs, services, maintenance,
 * accessories, replacements) with strict multi-tenant isolation and optional
 * document references.
 */
const expenseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for expense isolation'],
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },
    expenseType: {
      type: String,
      required: [true, 'Expense type is required'],
      enum: {
        values: [
          'PURCHASE',
          'REPAIR',
          'SERVICE',
          'MAINTENANCE',
          'ACCESSORY',
          'REPLACEMENT',
          'OTHER',
        ],
        message: '{VALUE} is not a supported expense type',
      },
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Expense amount is required'],
      min: [0.01, 'Expense amount must be greater than zero'],
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    expenseDate: {
      type: Date,
      required: [true, 'Expense date is required'],
      default: Date.now,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Expense title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },
    vendorName: {
      type: String,
      trim: true,
      maxlength: [150, 'Vendor name cannot exceed 150 characters'],
      default: '',
    },
    relatedDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      default: null,
    },
    relatedServiceRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceRecord',
      default: null,
      index: true,
    },
    source: {
      type: String,
      enum: ['MANUAL', 'DOCUMENT', 'AI', 'SYSTEM', 'SERVICE'],
      default: 'MANUAL',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// High-performance compound indexes for deterministic analytics queries
expenseSchema.index({ userId: 1, expenseDate: -1 });
expenseSchema.index({ productId: 1, expenseDate: -1 });
expenseSchema.index({ userId: 1, productId: 1 });
expenseSchema.index({ userId: 1, expenseType: 1 });

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;
