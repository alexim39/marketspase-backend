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
  qualificationMilestonesSchema,
  loginStreakSchema,
  badgeProfileSchema,
  gamificationProfileSchema,
  securityProfileSchema,
  fraudProfileSchema
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
      select: false,
    },
    authenticationMethod: {
      type: String,
      enum: AUTH_METHODS_ARRAY,
      default: 'google.com',
    },
    authProviders: {
      type: [{
        type: String,
        enum: AUTH_METHODS_ARRAY,
      }],
      default: function () {
        return this.authenticationMethod ? [this.authenticationMethod] : [];
      },
    },
    localAuth: {
      enabled: { type: Boolean, default: false },
      passwordSetAt: { type: Date, default: null },
      passwordLastUsedAt: { type: Date, default: null },
      verificationCodeHash: { type: String, select: false },
      verificationCodeExpiresAt: { type: Date, select: false },
      verificationRequestedAt: { type: Date, select: false },
      resetCodeHash: { type: String, select: false },
      resetCodeExpiresAt: { type: Date, select: false },
      resetRequestedAt: { type: Date, select: false },
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
    promoterTier: { type: String, enum: ['unranked', 'bronze', 'silver', 'gold'], default: 'unranked' },
    preferredCurrency: { type: String, enum: ['NGN', 'USD', 'GHS', 'KES', 'ZAR', 'XOF'], default: 'NGN' },
    regionalCountry: { type: String, default: 'NG' },
    preferredLocale: { type: String, default: 'en' },
    ratingCount: { type: Number, default: DEFAULTS.RATING_COUNT },
    ratingUpdatedAt: { type: Date, default: null },
    collaborationRating: { type: Number, default: 0 },
    collaborationRatingCount: { type: Number, default: 0 },
    collaborationReviewCount: { type: Number, default: 0 },
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
    fcmTokens: [String],

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

    loginStreak: { type: loginStreakSchema, default: () => ({}) },
    badgeProfile: { type: badgeProfileSchema, default: () => ({}) },
    gamificationProfile: { type: gamificationProfileSchema, default: () => ({}) },
    securityProfile: { type: securityProfileSchema, default: () => ({}) },
    fraudProfile: { type: fraudProfileSchema, default: () => ({}) },

    // Forum activity
    forumActivity: { type: forumActivitySchema, default: () => ({}) },

    lastSeenAt: { type: Date, index: true },

    userDevice: { type: String },
  },
  { timestamps: true, validateModifiedOnly: true }
);

export default userSchema;
