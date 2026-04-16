import mongoose from "mongoose";
import { activitySchema } from "../activity/index.js";
import { 
  USER_ROLES_ARRAY, 
  AUTH_METHODS_ARRAY,
  DEFAULTS 
} from "./user.constants.js";
import {
  walletSchema,
  payoutAccountSchema,
  notificationSettingsSchema,
  notificationStatsSchema,
  deviceTokenSchema,
  sseConnectionSchema,
  personalInfoSchema,
  professionalInfoSchema,
  preferencesSchema,
  forumActivitySchema,
  referralSchema,
  activitySettingsSchema,
  qualificationMilestonesSchema
} from "./schemas/index.js";

const userSchema = new mongoose.Schema(
  {
    uid: { type: String, unique: true, required: true },
    username: { type: String, unique: true, required: true, trim: true },
    displayName: { type: String, trim: true, required: true },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    password: {
      type: String,
      trim: true,
      required: function () { return this.authenticationMethod === 'local'; },
    },
    authenticationMethod: {
      type: String,
      enum: AUTH_METHODS_ARRAY,
      default: 'google.com',
    },

    role: {
      type: String,
      enum: USER_ROLES_ARRAY,
      default: 'marketer',
    },

    type: {
      type: String,
      enum: ['user', 'admin', 'moderator'], // Can be extended in the future
      default: 'user', // This can be used for permission checks and other logic and is only editable by admins
    },
    
    isMarketingRep: { type: Boolean, default: DEFAULTS.IS_MARKETING_REP },

    avatar: { type: String, default: DEFAULTS.AVATAR },

    // Dual wallets (separate tracking for each role)
    wallets: {
      marketer: { type: walletSchema, default: () => ({}) },
      promoter: { type: walletSchema, default: () => ({}) },
    },

    savedAccounts: [payoutAccountSchema],

    // Engagement & trust
    rating: { type: Number, default: DEFAULTS.RATING },
    ratingCount: { type: Number, default: DEFAULTS.RATING_COUNT },
    testimonials: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Testimonial' }],

    // System flags
    isActive: { type: Boolean, default: DEFAULTS.IS_ACTIVE },
    isVerified: { type: Boolean, default: DEFAULTS.IS_VERIFIED },
    isDeleted: { type: Boolean, default: DEFAULTS.IS_DELETED },

    // Notification system fields
    notificationSettings: { 
      type: notificationSettingsSchema, 
      default: () => ({}) 
    },
    notificationStats: { 
      type: notificationStatsSchema, 
      default: () => ({}) 
    },
    deviceTokens: [deviceTokenSchema],
    sseConnections: [sseConnectionSchema],

    // Targeting info
    personalInfo: { type: personalInfoSchema, default: () => ({}) },
    professionalInfo: { type: professionalInfoSchema, default: () => ({}) },
    interests: {
      hobbies: [{ type: String }],
      favoriteTopics: [{ type: String }]
    },
    preferences: { type: preferencesSchema, default: () => ({}) },

    // Add activity tracking array
    activityLog: [activitySchema],
      
    // Activity tracking settings
    activitySettings: { type: activitySettingsSchema, default: () => ({}) },

    // Referral info
    referralInfo: {
      referralCode: { type: String, unique: true, sparse: true }, // Same as username
      referredBy: { type: String }, // Username of referrer
      totalReferrals: { type: Number, default: 0 },
      totalEarned: { type: Number, default: 0 },
      referrals: [referralSchema]
    },
    
    // Track qualification milestones
    qualificationMilestones: { type: qualificationMilestonesSchema, default: () => ({}) },

    // Forum activity
    forumActivity: { type: forumActivitySchema, default: () => ({}) },

    lastSeenAt: { type: Date, index: true },

    userDevice: { type: String },
  },
  { timestamps: true }
);

export default userSchema;