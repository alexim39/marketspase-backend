// Onboarding state — persisted per user to track completion
import mongoose from 'mongoose';

const onboardingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  completed: { type: Boolean, default: false },
  completedSteps: [{ type: String }], // ['welcome', 'first_campaign', 'first_message']
  completedAt: Date,
  dismissed: { type: Boolean, default: false },
}, { timestamps: true });

export const OnboardingModel = mongoose.model('Onboarding', onboardingSchema);
