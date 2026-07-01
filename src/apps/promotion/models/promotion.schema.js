import mongoose from "mongoose";
import { 
  PROMOTION_STATUS_ARRAY, 
  NOTIFICATION_TYPES_ARRAY,
  DEFAULTS,
  VALIDATION
} from "./promotion.constants.js";
import { isValidProofViews } from "./promotion.utils.js";
import { normalizePromotionUrl } from "../utils/promotion-url.js";
import { spread } from "axios";

const promotionSchema = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
    },
    promoter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 🔄 NEW LIFECYCLE
    status: {
      type: String,
      enum: PROMOTION_STATUS_ARRAY,
      default: DEFAULTS.STATUS,
    },

    acceptedAt: {
      type: Date,
      default: Date.now,
    },
    downloadedAt: Date,
    submittedAt: Date,
    validatedAt: Date,
    rejectedAt: Date,
    autoRejectedAt: Date,
    paidAt: Date,

    proofMedia: [String],

    proofViews: {
      type: Number,
      min: 0,
      validate: {
        validator: function (value) {
          return isValidProofViews(value, this.status, VALIDATION.MIN_PROOF_VIEWS);
        },
        message: `Valid submitted views (≥${VALIDATION.MIN_PROOF_VIEWS}) are required`,
      },
    },

    payoutAmount: {
      type: Number,
      min: 0,
    },

    payoutModel: {
      type: String,
      enum: ["fixed_per_promoter", "pay_per_click"],
      default: "pay_per_click",
    },

    costPerClick: {
      type: Number,
      min: 0,
      default: 0,
    },

    payoutSnapshot: {
      model: {
        type: String,
        enum: ["range_based", "fixed_per_promoter", "pay_per_click"],
      },
      tierId: String,
      payoutAmount: Number,
      costPerClick: Number,
      minViews: Number,
      maxViews: Number,
      lockedAt: Date,
      tierBonus: { type: Number, default: 0 },
      promoterTier: String,
    },

    viewsUsedForPayout: Number,
    viewsAchieved: { type: Number, default: 0, min: 0 },

    rejectionReason: String,
    notes: String,

    isDownloaded: {
      type: Boolean,
      default: DEFAULTS.IS_DOWNLOADED,
    },

    upi: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    promotionUrl: {
      type: String,
      trim: true,
      set: (value) => normalizePromotionUrl(value),
    },
    destinationUrl: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    clickStats: {
      totalClicks: { type: Number, default: 0, min: 0 },
      billableClicks: { type: Number, default: 0, min: 0 },
      invalidClicks: { type: Number, default: 0, min: 0 },
      duplicateClicks: { type: Number, default: 0, min: 0 },
      earnedAmount: { type: Number, default: 0, min: 0 },
      lastClickAt: Date,
    },
    fraudStatus: {
      isFlagged: { type: Boolean, default: false },
      reviewStatus: {
        type: String,
        enum: ["clear", "warning", "final_warning", "blocked", "resolved"],
        default: "clear",
      },
      riskLevel: {
        type: String,
        enum: ["low", "medium", "high", "critical"],
        default: "low",
      },
      reasonSummary: {
        type: String,
        trim: true,
        default: "",
      },
      reasons: {
        type: [String],
        default: [],
      },
      warningCount: { type: Number, min: 0, default: 0 },
      firstFlaggedAt: Date,
      lastFlaggedAt: Date,
      blockedAt: Date,
      blockedUntil: Date,
      autoRestoredAt: Date,
      manualHold: { type: Boolean, default: false },
      manualHoldAt: Date,
      manualHoldBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        default: null,
      },
      manualHoldReason: {
        type: String,
        trim: true,
        default: "",
      },
      lastCaseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PromotionFraudCase",
        default: null,
      },
    },

    validatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    notificationLog: [
      {
        type: {
          type: String,
          enum: NOTIFICATION_TYPES_ARRAY,
          required: true,
        },
        sentAt: {
          type: Date,
          default: Date.now,
        },
        metadata: mongoose.Schema.Types.Mixed,
      },
    ],

    reminders: {
      submission: {
        lastSent: Date,
        sentCount: { type: Number, default: DEFAULTS.REMINDER_SENT_COUNT },
      },
      validation: {
        lastSent: Date,
        sentCount: { type: Number, default: DEFAULTS.REMINDER_SENT_COUNT },
      },
    },

    activityLog: [
      {
        action: String,
        details: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],

    // 🛡️ SAFETY FLAGS
    hasReservedFromMarketer: { type: Boolean, default: DEFAULTS.HAS_RESERVED_FROM_MARKETER },
    hasReservedForPromoter: { type: Boolean, default: DEFAULTS.HAS_RESERVED_FOR_PROMOTER },
    hasBeenPaid: { type: Boolean, default: DEFAULTS.HAS_BEEN_PAID },
    hasBeenRefunded: { type: Boolean, default: DEFAULTS.HAS_BEEN_REFUNDED },

    accounting: {
      validatedCounted: { type: Boolean, default: false },
      paidCounted: { type: Boolean, default: false },
    },

  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export default promotionSchema;
