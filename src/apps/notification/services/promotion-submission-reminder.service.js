// src/apps/notification/services/promotion-auto-reject.service.js

import { PromotionModel } from './../../promotion/models/promotion.model.js';
import { NotificationService } from './notification.service.js';
import { sendEmail } from "../../../services/email.service.js";
import { promotionExpiringTemplate } from "../../promotion/services/email/promotionExpiringTemplate.js";

export const promotionSubmissionReminder = async () => {

      try {
        console.log("⏳ Running 20-hour submission reminder job...");
    
        const now = new Date();
    
        /**
         * ⏱ TIME WINDOW
         * Promotions created between 19.5h and 20.5h ago
         */
        const minTime = new Date(now.getTime() - 20.5 * 60 * 60 * 1000);
        const maxTime = new Date(now.getTime() - 19.5 * 60 * 60 * 1000);
    
        /**
         * 🔍 FIND ELIGIBLE PROMOTIONS
         */
        const pendingPromotions = await PromotionModel.find({
          status: "downloaded",
          isDownloaded: true,              // accepted + downloaded
          proofSubmitted: false,           // not yet submitted
          createdAt: { $gte: minTime, $lte: maxTime },
          submissionReminderSentAt: { $exists: false } // idempotency guard
        })
          .populate("promoter", "_id displayName email")
          .populate("campaign", "_id title payoutPerPromotion")
          .lean();
    
        console.log(
          `📊 Found ${pendingPromotions.length} promotions at ~20-hour mark`
        );
    
        let remindersSent = 0;
    
        for (const promotion of pendingPromotions) {
          try {
            const assignmentTime = new Date(promotion.createdAt);
            const hoursSinceAssignment =
              (now - assignmentTime) / (1000 * 60 * 60);
    
            const hoursLeft = Math.max(1, Math.ceil(24 - hoursSinceAssignment));
    
            const promoter = promotion.promoter;
            const campaign = promotion.campaign;
    
            /**
             * 🔔 IN-APP NOTIFICATION
             */
            await NotificationService.createSubmissionReminder(
              promoter._id,
              campaign,
              promotion,
              hoursLeft
            );
    
            /**
             * 📧 EMAIL REMINDER
             */
            const hoursLeftText = hoursLeft > 1 ? `${hoursLeft} Hours` : "1 Hour";
    
            const emailData = {
              promoterName: promoter.displayName,
              campaignTitle: campaign.title,
              promotionId: promotion.upi || promotion._id.toString(),
              payoutAmount: campaign.payoutPerPromotion,
              expiresAt: new Date(
                assignmentTime.getTime() + 24 * 60 * 60 * 1000
              )
            };
    
            const emailContent = promotionExpiringTemplate(emailData);
    
            await sendEmail(
              promoter.email,
              `⏳ ${hoursLeftText} Left: Upload Proof for ${campaign.title}`,
              emailContent
            );
    
            /**
             * 🧾 UPDATE PROMOTION (IDEMPOTENT)
             */
            await PromotionModel.updateOne(
              {
                _id: promotion._id,
                submissionReminderSentAt: { $exists: false }
              },
              {
                $set: {
                  submissionReminderSentAt: new Date()
                },
                $push: {
                  activityLog: {
                    action: "Submission Reminder Sent",
                    details: `${hoursLeftText} left before expiration`,
                    timestamp: new Date()
                  }
                }
              }
            );
    
            remindersSent++;
    
            console.log(
              `✅ Reminder sent for promotion ${promotion._id} (${hoursLeft}h left)`
            );
    
          } catch (error) {
            console.error(
              `❌ Error sending reminder for promotion ${promotion._id}:`,
              error
            );
          }
        }
    
        console.log(
          `🎉 20-hour reminder job completed — ${remindersSent} reminder(s) sent`
        );
    
      } catch (error) {
        console.error("❌ Error in 20-hour reminder job:", error);
      }
}