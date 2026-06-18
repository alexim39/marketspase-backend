import mongoose from 'mongoose';

const landingEventSchema = new mongoose.Schema({
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
  promotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion' },
  promoter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  marketer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  upi: { type: String, index: true },
  event: {
    type: String,
    required: true,
    enum: [
      'landing_view', 'landing_duration', 'continue_click',
      'contact_me_select', 'form_view',
      'form_submit', 'lead_success', 'lead_failure',
      'proceed_click',
    ],
  },
  durationMs: { type: Number },       // for landing_duration events
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  phone: { type: String },             // anonymized for privacy
  error: { type: String },             // for lead_failure events
  sessionId: { type: String, index: true },  // groups events from same visitor
  meta: { type: Object, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } });

landingEventSchema.index({ campaign: 1, event: 1, createdAt: -1 });
landingEventSchema.index({ promoter: 1, event: 1, createdAt: -1 });
landingEventSchema.index({ marketer: 1, createdAt: -1 });

export const LandingEventModel = mongoose.model('LandingEvent', landingEventSchema);
