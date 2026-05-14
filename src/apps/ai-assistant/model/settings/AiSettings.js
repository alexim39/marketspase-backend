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

const escalationRulesSchema = new mongoose.Schema(
  {
    escalateOnKeywords: { type: Boolean, default: true },
    lowConfidence: { type: Boolean, default: true },
    complaints: { type: Boolean, default: true },
    highValue: { type: Boolean, default: true },
    keywords: {
      type: [String],
      default: () => ['human', 'agent', 'speak to someone', 'complaint', 'refund', 'manager', 'bulk order'],
    },
  },
  { _id: false }
);

const productLinkSchema = new mongoose.Schema(
  {
    label: { type: String, default: '' },
    url: { type: String, default: '' },
  },
  { _id: false }
);

const autoLinksSchema = new mongoose.Schema(
  {
    storefrontUrl: { type: String, default: '' },
    paymentLink: { type: String, default: '' },
    productLinks: { type: [productLinkSchema], default: () => [] },
  },
  { _id: false }
);

const businessHoursSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    start: { type: String, default: '09:00' },
    end: { type: String, default: '18:00' },
    timezone: { type: String, default: 'Africa/Lagos' },
  },
  { _id: false }
);

const responseSettingsSchema = new mongoose.Schema(
  {
    responseDelaySeconds: { type: Number, default: 2, min: 0, max: 60 },
    maxAiRepliesBeforeEscalation: { type: Number, default: 8, min: 1, max: 50 },
    businessHours: { type: businessHoursSchema, default: () => ({}) },
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

    escalationRules: {
      type: escalationRulesSchema,
      default: () => ({}),
    },

    autoLinks: {
      type: autoLinksSchema,
      default: () => ({}),
    },

    responseSettings: {
      type: responseSettingsSchema,
      default: () => ({}),
    },

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
