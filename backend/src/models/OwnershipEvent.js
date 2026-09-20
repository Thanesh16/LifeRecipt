import mongoose from 'mongoose';

const ownershipEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },
    eventType: {
      type: String,
      required: [true, 'Event type is required'],
      enum: {
        values: [
          'PURCHASED',
          'DOCUMENT_ADDED',
          'WARRANTY_INFO_ADDED',
          'RETURN_INFO_ADDED',
          'NOTE_ADDED',
          'SERVICE',
          'MAINTENANCE',
          'REPAIR',
          'ACCESSORY',
          'REPLACEMENT',
          'EXPENSE_ADDED',
          'OTHER',
          'OWNERSHIP_TRANSFER',
          'TRANSFER_INITIATED',
          'TRANSFER_ACCEPTED',
          'TRANSFER_REJECTED',
          'TRANSFER_CANCELLED',
          'LIFECYCLE_STAGE_CHANGED',
          'EMAIL_RECEIPT_IMPORTED',
          'SERVICE_REQUESTED',
          'SERVICE_SCHEDULED',
          'SERVICE_IN_PROGRESS',
          'SERVICE_WAITING_PARTS',
          'SERVICE_COMPLETED',
          'SERVICE_CANCELLED',
          'WARRANTY_CLAIM_SUBMITTED',
          'WARRANTY_CLAIM_RESOLVED',
          'PASSPORT_GENERATED',
          'PASSPORT_SHARED',
        ],
        message: '{VALUE} is not a supported event type',
      },
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },
    eventDate: {
      type: Date,
      required: [true, 'Event date is required'],
      default: Date.now,
      index: true,
    },
    source: {
      type: String,
      enum: ['SYSTEM', 'USER', 'AI', 'EMAIL', 'SERVICE', 'PASSPORT', 'MANUFACTURER'],
      default: 'SYSTEM',
    },
    relatedDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      default: null,
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

// Compound indexes for optimal query performance
ownershipEventSchema.index({ productId: 1, eventDate: -1 });
ownershipEventSchema.index({ userId: 1, eventDate: -1 });
ownershipEventSchema.index({ productId: 1, eventType: 1 });
ownershipEventSchema.index({ productId: 1, 'metadata.expenseId': 1 });

const OwnershipEvent = mongoose.model('OwnershipEvent', ownershipEventSchema);

export default OwnershipEvent;
