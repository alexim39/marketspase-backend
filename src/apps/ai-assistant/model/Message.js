import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true,
    },
    content: { type: String, required: true },
    type: { type: String, default: 'text' },
    source: {
      type: String,
      enum: ['customer', 'ai', 'faq', 'agent'],
      default: 'customer',
    },
    timestamp: { type: Date, default: Date.now },
  },
);

messageSchema.index({ conversationId: 1, timestamp: 1 });

export default mongoose.model('Message', messageSchema);