import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerWaId: { type: String, required: true }, // WhatsApp ID of customer (e.g. "2348012345678")
    customerName: { type: String, default: 'Customer' },
    status: {
      type: String,
      enum: ['active', 'escalated', 'resolved'],
      default: 'active',
    },
    lastMessageText: String,
    lastMessageAt: Date,
  },
  { timestamps: true }
);

conversationSchema.index({ userId: 1, customerWaId: 1 });
conversationSchema.index({ userId: 1, status: 1 });

export default mongoose.model('Conversation', conversationSchema);