import { generateUniqueUpi } from "./../utils/generateUniqueUpi.js";
import { NOTIFICATION_TYPES, DEFAULTS } from "./promotion.constants.js";
import { createActivityEntry } from "./promotion.utils.js";
import mongoose from "mongoose";

export const setupPromotionMiddleware = (schema) => {
  // Pre-save middleware
  schema.pre('save', function(next) {
    // Generate UPI for new documents
    if (this.isNew && !this.upi) {
      this.upi = generateUniqueUpi().toString();
    }

    // Handle status changes
    if (this.isModified('status')) {
      const now = new Date();

      switch (this.status) {
        case 'accepted':
          this.activityLog.push(createActivityEntry('Promotion Accepted'));
          this._pendingNotification = { type: NOTIFICATION_TYPES.PROMOTION_ASSIGNED, timestamp: now };
          break;

        case 'downloaded':
          if (!this.downloadedAt) this.downloadedAt = now;
          this.isDownloaded = true;
          this.activityLog.push(createActivityEntry('Promotion Downloaded'));
          this._pendingNotification = { type: NOTIFICATION_TYPES.PROMOTION_DOWNLOADED, timestamp: now };
          break;

        case 'submitted':
          if (!this.submittedAt) this.submittedAt = now;
          this.activityLog.push(createActivityEntry('Promotion Submitted'));
          this._pendingNotification = { type: NOTIFICATION_TYPES.PROMOTION_SUBMITTED, timestamp: now };
          break;

        case 'validated':
          if (!this.validatedAt) this.validatedAt = now;
          this.activityLog.push(createActivityEntry('Promotion Validated'));
          this._pendingNotification = { type: NOTIFICATION_TYPES.PROMOTION_VALIDATED, timestamp: now };
          break;

        case 'paid':
          if (!this.hasBeenPaid) {
            this.paidAt = now;
            this.hasBeenPaid = true;
            this.activityLog.push(createActivityEntry('Promotion Paid'));
            this._pendingNotification = { type: NOTIFICATION_TYPES.PAYMENT_PROCESSED, timestamp: now };
          }
          break;

        case 'rejected':
          this.activityLog.push(createActivityEntry('Promotion Rejected', this.rejectionReason));
          this._pendingNotification = { type: NOTIFICATION_TYPES.PROMOTION_REJECTED, timestamp: now };
          break;
      }
    }

    // Set default values for new documents
    if (this.isNew) {
      this.hasReservedFromMarketer = DEFAULTS.HAS_RESERVED_FROM_MARKETER;
      this.hasReservedForPromoter = DEFAULTS.HAS_RESERVED_FOR_PROMOTER;
      this.hasBeenPaid = DEFAULTS.HAS_BEEN_PAID;
      this.hasBeenRefunded = DEFAULTS.HAS_BEEN_REFUNDED;
      
      if (!this.reminders) {
        this.reminders = {
          submission: { sentCount: 0 },
          validation: { sentCount: 0 }
        };
      }
    }

    next();
  });

  // Post-save middleware for notifications
  schema.post('save', async function(doc) {
    if (!doc._pendingNotification) return;

    const { type, timestamp } = doc._pendingNotification;
    delete doc._pendingNotification; // Clean up

    // Import here to avoid circular dependencies
    const { NotificationService } = await import('../../notification/services/notification.service.js');
    const { withTimeout, SERVICE_TIMEOUTS } = await import('./promotion.utils.js');

    // Run notification in background
    setImmediate(async () => {
      try {
        const PromotionModel = doc.constructor;
        
        // Check if notification already sent
        const alreadyLogged = await PromotionModel.exists({
          _id: doc._id,
          "notificationLog.type": type,
        });

        if (alreadyLogged) return;

        const CampaignModel = mongoose.model('Campaign');
        const campaign = await CampaignModel.findById(doc.campaign);
        if (!campaign) return;

        // Send notification based on type
        switch (type) {
          case NOTIFICATION_TYPES.PROMOTION_ASSIGNED:
            await withTimeout(
              NotificationService.createPromotionAssignedNotification(doc.promoter, campaign, doc),
              SERVICE_TIMEOUTS.NOTIFICATION,
              "createPromotionAssignedNotification"
            );
            break;

          case NOTIFICATION_TYPES.PROMOTION_SUBMITTED:
            await withTimeout(
              NotificationService.createPromotionSubmittedNotification(campaign.owner, doc, campaign),
              SERVICE_TIMEOUTS.NOTIFICATION,
              "createPromotionSubmittedNotification"
            );
            break;

          case NOTIFICATION_TYPES.PROMOTION_VALIDATED:
            await withTimeout(
              NotificationService.createPromotionValidatedNotification(doc.promoter, doc, campaign),
              SERVICE_TIMEOUTS.NOTIFICATION,
              "createPromotionValidatedNotification"
            );
            break;

          case NOTIFICATION_TYPES.PAYMENT_PROCESSED:
            await withTimeout(
              NotificationService.createPaymentProcessedNotification(doc.promoter, doc.payoutAmount, doc, "promoter"),
              SERVICE_TIMEOUTS.NOTIFICATION,
              "createPaymentProcessedNotification"
            );
            break;

          case NOTIFICATION_TYPES.PROMOTION_REJECTED:
            await withTimeout(
              NotificationService.createPromotionRejectedNotification(doc.promoter, doc, campaign, doc.rejectionReason),
              SERVICE_TIMEOUTS.NOTIFICATION,
              "createPromotionRejectedNotification"
            );
            break;
        }

        // Log notification
        await PromotionModel.updateOne(
          { _id: doc._id },
          { $push: { notificationLog: { type, sentAt: timestamp } } }
        );
      } catch (err) {
        console.error("Notification background error:", err.message);
      }
    });
  });
};