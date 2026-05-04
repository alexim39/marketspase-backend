import mongoose from 'mongoose';

const whatsAppNumberSchema = new mongoose.Schema(
  {
    phoneNumber: { type: String, required: true },
    aiEnabled: { type: Boolean, default: false },
  },
  { _id: false }
);

const notificationPreferencesSchema = new mongoose.Schema(
  {
    newMessage: { type: Boolean, default: true },
    escalation: { type: Boolean, default: true },
    paymentConfirmation: { type: Boolean, default: false },
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    planId: {
      type: String,
      enum: ['basic', 'advanced'],
      default: 'basic',
    },
    startDate: { type: Date },
    endDate: { type: Date },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'expired'],
      default: 'active',
    },
  },
  { _id: false }
);

const aiSettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      unique: true,
      required: true,
    },
    tone: {
      type: String,
      enum: ['friendly', 'professional', 'sales'],
      default: 'friendly',
    },
    language: {
      type: String,
      enum: ['english', 'pidgin'],
      default: 'english',
    },
    aiEnabled: { type: Boolean, default: false },        // global AI toggle


    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
    },

    notificationPreferences: {
      type: notificationPreferencesSchema,
      default: () => ({}),
    },

    subscription: {
      type: subscriptionSchema,
      default: () => ({}),
    },

    whatsappNumbers: [whatsAppNumberSchema],
  },
  { timestamps: true }
);

export default mongoose.model('AiSettings', aiSettingsSchema);