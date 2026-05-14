import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  content: { type: String, required: true },
  category: { type: String, enum: ['payment', 'product', 'greeting', 'escalation', 'custom'], default: 'custom' },
  variables: [{ type: String }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('MessageTemplate', templateSchema);