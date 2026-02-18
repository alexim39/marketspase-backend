import mongoose from "mongoose";
import { NotificationService } from "../../notification/services/notification.service.js";
import { generateUniqueUpi } from "./../utils/generateUniqueUpi.js";


const withTimeout = (p, ms, label = "operation") =>
  Promise.race([
    p,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);


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
      enum: ["accepted", "downloaded", "submitted", "validated", "rejected", "paid"],
      default: "accepted",
    },

    acceptedAt: {
      type: Date,
      default: Date.now,
    },
    downloadedAt: Date,
    submittedAt: Date,
    validatedAt: Date,
    rejectedAt: Date,
    paidAt: Date,

    proofMedia: [String],

    proofViews: {
      type: Number,
      min: 0,
      validate: {
        validator: function (value) {
          if (this.status !== "submitted" && this.status !== "validated") return true;
          return Number.isFinite(value) && value >= 35;
        },
        message: "Valid submitted views (≥35) are required",
      },
    },

    payoutAmount: {
      type: Number,
      min: 0,
    },

    viewsUsedForPayout: Number,

    rejectionReason: String,
    notes: String,

    isDownloaded: {
      type: Boolean,
      default: false,
    },

    upi: {
      type: String,
      unique: true,
      default: function () {
        if (this.isNew) return generateUniqueUpi().toString();
        return this.upi;
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
          enum: [
            "promotion_assigned",
            "promotion_downloaded",
            "promotion_submitted",
            "promotion_validated",
            "promotion_rejected",
            "payment_processed",
            "submission_reminder",
            "deadline_reminder",
          ],
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
        sentCount: { type: Number, default: 0 },
      },
      validation: {
        lastSent: Date,
        sentCount: { type: Number, default: 0 },
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
    hasReservedFromMarketer: { type: Boolean, default: false },
    hasReservedForPromoter: { type: Boolean, default: false },
    hasBeenPaid: { type: Boolean, default: false },
    hasBeenRefunded: { type: Boolean, default: false },

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

//
// 🔐 INDEXES (UPDATED FOR NEW FLOW)
//
promotionSchema.index(
  { campaign: 1, promoter: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["accepted", "downloaded", "submitted"] },
    },
    name: "uniq_campaign_promoter_active",
  }
);

promotionSchema.index({ status: 1 });
promotionSchema.index({ promoter: 1, status: 1 });
promotionSchema.index({ campaign: 1, status: 1 });
promotionSchema.index({ upi: 1 }, { unique: true });
promotionSchema.index({ submittedAt: 1 });

promotionSchema.index({ campaign: 1, promoter: 1 }, { name: "ix_campaign_promoter_all_statuses" });

//
// 🧠 VIRTUALS
//
promotionSchema.virtual("daysSinceSubmission").get(function () {
  if (!this.submittedAt) return null;
  return Math.ceil((Date.now() - this.submittedAt) / 86400000);
});

promotionSchema.virtual("isOverdue").get(function () {
  if (!this.submittedAt) return false;
  if (["paid", "rejected"].includes(this.status)) return false;
  return this.daysSinceSubmission > 7;
});

promotionSchema.virtual("needsSubmissionReminder").get(function () {
  if (this.status !== "downloaded") return false;
  const hours = (Date.now() - this.downloadedAt) / 3600000;
  return hours >= 20 && hours <= 24;
});

//
// 🔄 PRE-SAVE STATUS HANDLING (IDEMPOTENT)
//
promotionSchema.pre("save", function (next) {
  if (!this.isModified("status")) return next();

  const now = new Date();

  switch (this.status) {
    case "accepted":
      this.activityLog.push({ action: "Promotion Accepted" });
      this._pendingNotification = { type: "promotion_assigned", timestamp: now };
      break;

    case "downloaded":
      if (!this.downloadedAt) this.downloadedAt = now;
      this.isDownloaded = true;
      this.activityLog.push({ action: "Promotion Downloaded" });
      this._pendingNotification = { type: "promotion_downloaded", timestamp: now };
      break;

    case "submitted":
      if (!this.submittedAt) this.submittedAt = now;
      this.activityLog.push({ action: "Promotion Submitted" });
      this._pendingNotification = { type: "promotion_submitted", timestamp: now };
      break;

    case "validated":
      if (!this.validatedAt) this.validatedAt = now;
      this.activityLog.push({ action: "Promotion Validated" });
      this._pendingNotification = { type: "promotion_validated", timestamp: now };
      break;

    case "paid":
      // ✅ Idempotent paid transition
      if (this.hasBeenPaid) {
        // Already marked paid previously — ensure status/payload consistency, then no-op
        this.status = "paid";
        return next();
      }
      // First time entering "paid"
      this.paidAt = now;
      this.hasBeenPaid = true;
      this.status = "paid";
      this.activityLog.push({ action: "Promotion Paid" });
      this._pendingNotification = { type: "payment_processed", timestamp: now };
      break;


    case "rejected":
      this.activityLog.push({
        action: "Promotion Rejected",
        details: this.rejectionReason,
      });
      this._pendingNotification = { type: "promotion_rejected", timestamp: now };
      break;
  }

  next();
});

//
// 🔔 POST-SAVE NOTIFICATIONS (SAFE & DEDUPED)
//

promotionSchema.post("save", function (doc) {
  if (!doc._pendingNotification) return;

  const { type, timestamp } = doc._pendingNotification;

  // Prevent holding references on doc instance
  delete doc._pendingNotification;

  // 🔥 Do NOT await — run async in background
  setImmediate(async () => {
    try {
      const alreadyLogged = await PromotionModel.exists({
        _id: doc._id,
        "notificationLog.type": type,
      });

      if (alreadyLogged) return;

      const campaign = await mongoose.model("Campaign").findById(doc.campaign);
      if (!campaign) return;

      // ⏱️ Protect external calls with timeouts
      switch (type) {
        case "promotion_assigned":
          await withTimeout(
            NotificationService.createPromotionAssignedNotification(doc.promoter, campaign, doc),
            4000,
            "createPromotionAssignedNotification"
          );
          break;

        case "promotion_submitted":
          await withTimeout(
            NotificationService.createPromotionSubmittedNotification(campaign.owner, doc, campaign),
            4000,
            "createPromotionSubmittedNotification"
          );
          break;

        case "promotion_validated":
          await withTimeout(
            NotificationService.createPromotionValidatedNotification(doc.promoter, doc, campaign),
            4000,
            "createPromotionValidatedNotification"
          );
          break;

        case "payment_processed":
          await withTimeout(
            NotificationService.createPaymentProcessedNotification(doc.promoter, doc.payoutAmount, doc, "promoter"),
            4000,
            "createPaymentProcessedNotification"
          );
          break;

        case "promotion_rejected":
          await withTimeout(
            NotificationService.createPromotionRejectedNotification(doc.promoter, doc, campaign, doc.rejectionReason),
            4000,
            "createPromotionRejectedNotification"
          );
          break;
      }

      await PromotionModel.updateOne(
        { _id: doc._id },
        { $push: { notificationLog: { type, sentAt: timestamp } } }
      );
    } catch (err) {
      console.error("Notification background error:", err.message);
    }
  });
});


export const PromotionModel = mongoose.model("Promotion", promotionSchema);
