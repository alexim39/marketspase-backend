import mongoose from "mongoose";
import { CampaignModel } from "../models/campaign.model.js";
import { UserModel } from "../../user/models/user.model.js";

import { sendEmail } from "../../../services/email.service.js";
import { campaignApprovedTemplate } from "../services/email/campaignApprovedTemplate.js";
import { campaignRejectedTemplate } from "../services/email/campaignRejectedTemplate.js";
import { NotificationService } from "../../notification/services/notification.service.js";

/**
 * Admin / Owner controller to update campaign status
 * Aligned with performance-based budget consumption
 */
export const UpdateCampaignStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { status, details = "", performedBy } = req.body;

    // Normalize/sanitize performer id (avoid passing empty string)
    const performerId = (performedBy && mongoose.Types.ObjectId.isValid(performedBy))
      ? performedBy
      : undefined;

    console.log(`UpdateCampaignStatus called by ${performedBy} for campaign ${id} to status ${status}`);

    if (!id || !status) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Campaign ID and status are required"
      });
    }

    const validStatuses = [
      "pending",
      "active",
      "paused",
      "rejected",
      "completed",
      "expired",
      "exhausted",
      "draft",
      "validated"
    ];

    if (!validStatuses.includes(status)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid campaign status"
      });
    }
    

    const campaign = await CampaignModel.findById(id).session(session);

    if (!campaign) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Campaign not found"
      });
    }

    //console.log('campaign ',campaign);

    // 2️⃣ LOAD MARKETER + WALLET CHECK
    const marketer = await UserModel.findById(campaign.owner)
      .session(session)
      .select("email wallets.marketer.balance");

    if (!marketer) {
      return res.status(404).json({
        success: false,
        message: "Campaign owner not found"
      });
    }

    const numericBudget = Number(campaign.budget);
    if (!Number.isFinite(numericBudget) || numericBudget < 1000) {
       return res.status(400).json({
        success: false,
        message: "Minimum campaign budget is ₦1000."
      });
    }

    if (marketer.wallets.marketer.balance < numericBudget) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance to activate this campaign."
      });
    }

    /**
     * ✅ IDEMPOTENCY GUARD
     * Prevents double-activation, double-rejection, etc.
     */
    if (campaign.status === status) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: `Campaign already in '${status}' state`
      });
    }

    /**
     * 🔒 ACTIVATION RULES
     * When campaign becomes ACTIVE, we freeze its payout model
     */
    if (status === "active") {
      // Allow activation from `pending` or `paused` states
      if (!["pending", "paused"].includes(campaign.status)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Campaign can only be activated from pending or paused states"
        });
      }

      if (!campaign.budget || campaign.budget < 1000) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Campaign budget is invalid"
        });
      }

      /**
       * ✅ SNAPSHOT PAYOUT RULES
       * This protects historical correctness if tiers change later
       */
      // Only snapshot payout rules on the first activation (protect historical data)
      if (!campaign.payoutRulesSnapshot) {
        campaign.payoutRulesSnapshot = {
          model: "performance_based_views",
          tiers: [
            { min: 35, max: 65, payout: 100 },
            { min: 66, max: 101, payout: 200 },
            { min: 102, max: 150, payout: 300 },
            { min: 151, max: 310, payout: 400 },
            { min: 311, max: null, payout: 500 }
          ],
          lockedAt: new Date()
        };
      }

      if (!campaign.activatedAt) {
        campaign.activatedAt = new Date();
      }
    }

    /**
     * ❌ NO WALLET RESERVATION
     * Budget is spent dynamically as views are validated
     */

    campaign.updateStatus(status, performerId, details);
    await campaign.save({ session });

    await session.commitTransaction();
    session.endSession();

    /**
     * 📣 POST-COMMIT NOTIFICATIONS
     */
    try {
      const marketer = await UserModel.findById(campaign.owner);

      if (marketer?.email) {
        if (status === "active") {
          const emailContent = campaignApprovedTemplate({
            userName: marketer.displayName,
            campaignTitle: campaign.title,
            campaignId: campaign._id,
            budget: campaign.budget
          });

          await sendEmail(
            marketer.email,
            "Your Campaign Is Live 🚀 - MarketSpase",
            emailContent
          );

          await NotificationService.createCampaignApprovedNotification(
            campaign.owner,
            campaign
          );
        }

        if (status === "rejected") {
          const emailContent = campaignRejectedTemplate({
            userName: marketer.displayName,
            campaignTitle: campaign.title,
            budget: campaign.budget,
            refundAmount: campaign.budget - campaign.spentBudget,
            rejectionReason:
              details || "Your campaign did not meet our guidelines."
          });

          await sendEmail(
            marketer.email,
            "Campaign Not Approved - MarketSpase",
            emailContent
          );

          await NotificationService.createCampaignRejectedNotification(
            campaign.owner,
            campaign,
            details
          );
        }
      }
    } catch (notifyError) {
      console.error("Notification failure:", notifyError);
      // Intentionally non-blocking
    }

    return res.status(200).json({
      success: true,
      message: `Campaign status updated to '${status}'`,
      data: {
        id: campaign._id,
        title: campaign.title,
        status: campaign.status,
        budget: campaign.budget,
        spentBudget: campaign.spentBudget,
        remainingBudget: campaign.remainingBudget
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("UpdateCampaignStatus error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update campaign status",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined
    });
  }
};
