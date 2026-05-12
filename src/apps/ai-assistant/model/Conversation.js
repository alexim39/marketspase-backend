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
    handledBy: {
      type: String,
      enum: ['ai', 'human'],
      default: 'ai',
    },
    leadTag: {
      type: String,
      enum: ['new', 'hot', 'interested', 'pending', 'paid', 'follow_up'],
      default: 'new',
    },
    priority: {
      type: String,
      enum: ['normal', 'high'],
      default: 'normal',
    },
    unreadCount: { type: Number, default: 0 },
    escalationReason: { type: String, default: '' },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastMessageText: String,
    lastMessageAt: Date,
    lastMessageSource: {
      type: String,
      enum: ['customer', 'ai', 'faq', 'agent'],
      default: 'customer',
    },
    resolvedAt: Date,
  },
  { timestamps: true }
);

conversationSchema.index({ userId: 1, customerWaId: 1 });
conversationSchema.index({ userId: 1, status: 1 });
conversationSchema.index({ userId: 1, handledBy: 1 });
conversationSchema.index({ userId: 1, leadTag: 1 });
conversationSchema.index({ assignedTo: 1, status: 1 });

export default mongoose.model('Conversation', conversationSchema);
