import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    productContext: {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        default: null,
      },
      productName: { type: String, default: null },
      brand: { type: String, default: null },
      model: { type: String, default: null },
    },
    sources: [
      {
        type: {
          type: String,
          enum: [
            'DATABASE',
            'DOCUMENT',
            'WEB_OFFICIAL',
            'WEB_GOVERNMENT',
            'WEB_SECONDARY',
            'EXTERNAL_OFFICIAL',
            'EXTERNAL_SECONDARY',
            'SERVICE_RECORD',
            'PASSPORT',
            'SERVICE_CENTER',
          ],
          required: true,
        },
        title: { type: String, required: true },
        detail: { type: String, default: '' },
        url: { type: String, default: null },
        verified: { type: Boolean, default: true },
      },
    ],
    conflicts: [
      {
        field: { type: String, required: true },
        documentValue: { type: String, required: true },
        webValue: { type: String, required: true },
        explanation: { type: String, default: '' },
        discrepancy: { type: String, default: '' },
      },
    ],
    webSearched: {
      type: Boolean,
      default: false,
    },
    retrievalDate: {
      type: String,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for conversation isolation'],
      index: true,
    },
    sessionId: {
      type: String,
      required: [true, 'Session ID is required'],
      index: true,
    },
    title: {
      type: String,
      default: 'New Ownership Inquiry',
      trim: true,
    },
    messages: [messageSchema],
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ userId: 1, sessionId: 1 });
conversationSchema.index({ userId: 1, updatedAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
