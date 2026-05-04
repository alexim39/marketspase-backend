import mongoose from 'mongoose';

const whatsAppConfigSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      unique: true,
      required: true,
    },
    phoneNumber: { type: String, required: true },      // E.164 business number
    phoneNumberSid: String,                             // Twilio phone number SID
    twilioAccountSid: String,                           // encrypted
    twilioAuthToken: String,                            // encrypted
    webhookVerifyToken: String,                         // for Twilio webhook validation
  },
  { timestamps: true }
);

export default mongoose.model('WhatsAppConfig', whatsAppConfigSchema);