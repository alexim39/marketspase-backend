import mongoose from "mongoose";

// Notification preference schema (for each channel)
const notificationPreferenceSchema = new mongoose.Schema({
  email: { type: Boolean, default: true },
  push: { type: Boolean, default: true },
  inApp: { type: Boolean, default: true },
  sms: { type: Boolean, default: false }
}, { _id: false });

// Notification settings schema (for each notification type)
const notificationSettingsSchema = new mongoose.Schema({
  pushEnabled: { type: Boolean, default: true },

  // Campaign-related notifications
  campaignAssigned: { type: notificationPreferenceSchema, default: () => ({}) },
  campaignApproved: { type: notificationPreferenceSchema, default: () => ({}) },
  campaignRejected: { type: notificationPreferenceSchema, default: () => ({}) },
  campaignPaused: { type: notificationPreferenceSchema, default: () => ({}) },
  budgetExhausted: { type: notificationPreferenceSchema, default: () => ({}) },
  
  // Promotion-related notifications
  promotionSubmitted: { type: notificationPreferenceSchema, default: () => ({}) },
  promotionValidated: { type: notificationPreferenceSchema, default: () => ({}) },
  promotionRejected: { type: notificationPreferenceSchema, default: () => ({}) },
  submissionReminder: { type: notificationPreferenceSchema, default: () => ({}) },
  
  // Payment-related notifications
  paymentReceived: { type: notificationPreferenceSchema, default: () => ({}) },
  paymentProcessed: { type: notificationPreferenceSchema, default: () => ({}) },
  payoutReady: { type: notificationPreferenceSchema, default: () => ({}) },
  lowBalance: { type: notificationPreferenceSchema, default: () => ({}) },
  
  // System notifications
  weeklySummary: { type: notificationPreferenceSchema, default: () => ({}) },
  systemUpdates: { type: notificationPreferenceSchema, default: () => ({}) },
  securityAlerts: { type: notificationPreferenceSchema, default: () => ({}) }
}, { _id: false });

// Notification stats schema
const notificationStatsSchema = new mongoose.Schema({
  totalReceived: { type: Number, default: 0 },
  totalRead: { type: Number, default: 0 },
  lastReadAt: { type: Date, default: null },
  muteUntil: { type: Date, default: null }
}, { _id: false });

export {
  notificationPreferenceSchema,
  notificationSettingsSchema,
  notificationStatsSchema
};