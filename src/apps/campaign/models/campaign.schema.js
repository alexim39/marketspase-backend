import mongoose from "mongoose";
import {
  CAMPAIGN_STATUS_ARRAY,
  CAMPAIGN_TYPE_ARRAY,
  CAMPAIGN_PRIORITY_ARRAY,
  MEDIA_TYPE_ARRAY,
  PAYOUT_MODEL_ARRAY,
  AGE_TARGET_ARRAY,
  PROMOTION_TYPE_ARRAY,
  PROMOTION_GOAL_ARRAY,
  DIFFICULTY_ARRAY,
  NOTIFICATION_TYPES_ARRAY,
  DEFAULTS,
  VALIDATION
} from "./campaign.constants.js";

const campaignSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true },

    // Media Content
    mediaUrl: { type: String, required: true },
    caption: { type: String },
    link: { type: String }, // optional CTA link
    category: { type: String, required: true },
    mediaType: { type: String, enum: MEDIA_TYPE_ARRAY, required: true },
    thumbnailUrl: { type: String },

    // Budgeting
    budget: { type: Number, required: true, min: VALIDATION.BUDGET.MIN },
    currency: { type: String, default: DEFAULTS.CURRENCY },

    // Promotion & Tracking
    maxPromoters: { type: Number, min: VALIDATION.MAX_PROMOTERS.MIN }, // left for backwards compatibility, can be used for reference
    currentPromoters: { type: Number, min: 0, default: DEFAULTS.CURRENT_PROMOTERS }, // left for backwards compatibility, can be used for reference
    totalPromotions: { type: Number, default: DEFAULTS.TOTAL_PROMOTIONS }, // left for backwards compatibility, can be used for reference
    validatedPromotions: { type: Number, default: DEFAULTS.VALIDATED_PROMOTIONS }, // left for backwards compatibility, can be used for reference
    paidPromotions: { type: Number, default: DEFAULTS.PAID_PROMOTIONS }, // left for backwards compatibility, can be used for reference
    
    spentBudget: { type: Number, default: DEFAULTS.SPENT_BUDGET },
    totalPayouts: { type: Number, default: DEFAULTS.TOTAL_PAYOUTS },
    reservedBudget: { type: Number, default: DEFAULTS.RESERVED_BUDGET },

    payoutModel: {
      type: String,
      enum: PAYOUT_MODEL_ARRAY,
      default: DEFAULTS.PAYOUT_MODEL
    }, // left for backwards compatibility, can be used for reference

    costPerClick: {
      type: Number,
      default: DEFAULTS.COST_PER_CLICK,
      min: 0
    },
    totalClicks: { type: Number, default: DEFAULTS.TOTAL_CLICKS, min: 0 },
    billableClicks: { type: Number, default: DEFAULTS.BILLABLE_CLICKS, min: 0 },
    invalidClicks: { type: Number, default: DEFAULTS.INVALID_CLICKS, min: 0 },
    duplicateClicks: { type: Number, default: DEFAULTS.DUPLICATE_CLICKS, min: 0 },
    exhaustedAt: Date,
    lastClickAt: Date,

    payoutTierId: { type: String }, // left for backwards compatibility, can be used for reference
    payoutPerPromotion: { type: Number}, // left for backwards compatibility, can be used for reference
    minViewsPerPromotion: { type: Number}, // left for backwards compatibility, can be used for reference
    maxViewsPerPromotion: { type: Number }, // left for backwards compatibility, can be used for reference
    rejectedPromotions: { type: Number, default: DEFAULTS.REJECTED_PROMOTIONS },

    // Targeting & Requirements
    enableTarget: { type: Boolean, default: DEFAULTS.ENABLE_TARGET },
    ageTarget: {
      type: String,
      enum: AGE_TARGET_ARRAY,
      default: DEFAULTS.AGE_TARGET
    },
    targetLocations: [{
      id: { type: String, required: true },
      name: { type: String, required: true },
      type: { type: String, required: true },
      place_id: { type: String, required: true },
      coordinates: {
        lat: { type: Number, default: 0 },
        lng: { type: Number, default: 0 }
      },
      precision: { type: String, default: "medium" }
    }],
    requirements: [{ type: String }],
    minRating: { type: Number, default: DEFAULTS.MIN_RATING, min: VALIDATION.RATING.MIN, max: VALIDATION.RATING.MAX },

    // Campaign Type & Priority
    campaignType: {
      type: String,
      enum: CAMPAIGN_TYPE_ARRAY,
      default: DEFAULTS.CAMPAIGN_TYPE
    },
    priority: {
      type: String,
      enum: CAMPAIGN_PRIORITY_ARRAY,
      default: DEFAULTS.PRIORITY
    },

    // Campaign timeline
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date },
    hasEndDate: { type: Boolean, default: DEFAULTS.HAS_END_DATE },

    // Status
    status: {
      type: String,
      enum: CAMPAIGN_STATUS_ARRAY,
      default: CAMPAIGN_STATUS_ARRAY[6], // 'pending'
    },

    // Notification tracking fields
    notificationLog: [{
      type: {
        type: String,
        enum: NOTIFICATION_TYPES_ARRAY,
        required: true
      },
      sentTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      sentAt: {
        type: Date,
        default: Date.now
      },
      metadata: mongoose.Schema.Types.Mixed
    }],

    // Budget alert thresholds
    budgetAlerts: {
      sentAt: [Date],
      lastAlertPercentage: { type: Number, default: 0 }
    },

    // Submission reminder tracking
    submissionReminders: {
      lastSent: Date,
      sentCount: { type: Number, default: 0 }
    }, // left for backwards compatibility, can be used for reference

    // Campaign deletion
    isDeleted: { type: Boolean, default: DEFAULTS.IS_DELETED },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // Additional fields
    difficulty: {
      type: String,
      enum: DIFFICULTY_ARRAY,
      default: DEFAULTS.DIFFICULTY
    },
    tags: [{ type: String }],
    estimatedViews: { type: Number, default: 0 }, // NAME CHANGE SUGGESTION: estimatedReach - left for backwards compatibility, can be used for reference
    duration: { type: String },

    // A log for campaign actions
    activityLog: [
      {
        action: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        details: { type: String },
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
      },
    ],

    // Audit fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    // Store integration
    store: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },
    promotionType: {
      type: String,
      enum: PROMOTION_TYPE_ARRAY,
      default: DEFAULTS.PROMOTION_TYPE
    },
    promotedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],

    // Store promotion settings
    promotionGoal: {
      type: String,
      enum: PROMOTION_GOAL_ARRAY,
      default: DEFAULTS.PROMOTION_GOAL
    }
  },
  { timestamps: true }
);

export default campaignSchema;
