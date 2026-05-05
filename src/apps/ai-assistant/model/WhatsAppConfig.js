import mongoose from 'mongoose';

const whatsAppConfigSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    phoneNumber: { 
      type: String, 
      required: true,
      index: true,  // NOT unique — multiple users can use same number or one user can have multiple
    },
    phoneNumberSid: String,
    twilioAccountSid: { type: String, required: true },
    twilioAuthToken: { type: String, required: true },
    webhookVerifyToken: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compound index: one active config per phone per user
whatsAppConfigSchema.index({ userId: 1, phoneNumber: 1 }, { unique: true });

export default mongoose.model('WhatsAppConfig', whatsAppConfigSchema);