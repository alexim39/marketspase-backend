import mongoose from 'mongoose';

const faqSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    category: { type: String, default: '' },
    tags: [{ type: String }],
  },
  { timestamps: true }
);

// Text index for search
faqSchema.index({ question: 'text', answer: 'text' });
// Compound index for user queries
faqSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Faq', faqSchema);