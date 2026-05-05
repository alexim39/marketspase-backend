import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerWaId: { type: String, required: true },
    customerName: { type: String, default: 'Customer' },
    status: {
      type: String,
      enum: ['active', 'escalated', 'resolved'],
      default: 'active',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastMessageText: String,
    lastMessageAt: Date,
  },
  { timestamps: true }
);

conversationSchema.index({ userId: 1, customerWaId: 1 });
conversationSchema.index({ userId: 1, status: 1 });
conversationSchema.index({ assignedTo: 1, status: 1 });

export default mongoose.model('Conversation', conversationSchema);