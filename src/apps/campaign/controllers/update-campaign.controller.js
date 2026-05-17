import mongoose from "mongoose";
import { CampaignModel } from "../models/campaign.model.js";
import { UserModel } from "../../user/models/user/index.js";
import { sendEmail } from "../../../core/email.service.js";
import { campaignApprovedTemplate } from "../services/email/campaignApprovedTemplate.js";
import { campaignRejectedTemplate } from "../services/email/campaignRejectedTemplate.js";
import { NotificationService } from "../../notification/services/notification.service.js";
import {
  deactivateCampaignPromotions,
  getCampaignCostPerClickValue,
  getCampaignRemainingBudgetValue,
  reactivateCampaignPromotions,
} from "../services/campaign-runtime.service.js";

const ADMIN_ROLES = new Set(["admin", "super-admin"]);
const VALID_STATUSES = new Set([
  "pending",
  "active",
  "paused",
  "rejected",
  "completed",
  "expired",
  "exhausted",
  "draft",
]);

const canSelfTransitionTo = (currentStatus, nextStatus) => {
  if (nextStatus === "pending") {
    return ["draft", "rejected"].includes(currentStatus);
  }

  if (nextStatus === "paused") {
    return currentStatus === "active";
  }

  if (nextStatus === "active") {
    return currentStatus === "paused";
  }

  return false;
};

const canAdminTransitionTo = (currentStatus, nextStatus) => {
  switch (nextStatus) {
    case "pending":
      return ["draft", "rejected"].includes(currentStatus);
    case "active":
      return ["pending", "paused", "exhausted"].includes(currentStatus);
    case "paused":
      return currentStatus === "active";
    case "rejected":
      return ["draft", "pending", "paused", "active"].includes(currentStatus);
    case "completed":
    case "expired":
    case "exhausted":
      return currentStatus === "active";
    default:
      return false;
  }
};

const buildActivationWalletRequirement = (campaign) => {
  const remainingBudget = getCampaignRemainingBudgetValue(campaign);
  const costPerClick = getCampaignCostPerClickValue(campaign);
  return Math.max(remainingBudget, costPerClick);
};

const shouldSendApprovalNotification = (previousStatus, nextStatus) =>
  nextStatus === "active" && previousStatus !== "active";

const shouldSendRejectionNotification = (nextStatus) => nextStatus === "rejected";

export const UpdateCampaignStatus = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    const { status, details = "", performedBy } = req.body;

    if (!id || !status) {
      return res.status(400).json({
        success: false,
        message: "Campaign ID and status are required",
      });
    }

    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign status",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign ID format",
      });
    }

    const actorId = req.userId || performedBy;
    const isAdmin = ADMIN_ROLES.has(String(req.user?.role || "").toLowerCase());

    if (!actorId) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required to update campaign status",
      });
    }

    let responsePayload = null;
    let notificationPayload = null;

    await session.withTransaction(async () => {
      const campaign = await CampaignModel.findById(id).session(session);

      if (!campaign) {
        throw { status: 404, message: "Campaign not found" };
      }

      const isOwner = String(campaign.owner) === String(actorId);
      if (!isAdmin && !isOwner) {
        throw { status: 403, message: "You are not authorized to update this campaign" };
      }

      const previousStatus = String(campaign.status || "");
      if (previousStatus === status) {
        throw { status: 409, message: `Campaign already in '${status}' state` };
      }

      const transitionAllowed = isAdmin
        ? canAdminTransitionTo(previousStatus, status)
        : canSelfTransitionTo(previousStatus, status);

      if (!transitionAllowed) {
        throw {
          status: 400,
          message: `Campaign cannot move from '${previousStatus}' to '${status}'`,
        };
      }

      const marketer = await UserModel.findById(campaign.owner)
        .session(session)
        .select("displayName email wallets.marketer.balance");

      if (!marketer) {
        throw { status: 404, message: "Campaign owner not found" };
      }

      if (status === "active") {
        const activationRequirement = buildActivationWalletRequirement(campaign);
        const walletBalance = Number(marketer.wallets?.marketer?.balance ?? 0);
        const costPerClick = getCampaignCostPerClickValue(campaign);

        if (!Number.isFinite(Number(campaign.budget)) || Number(campaign.budget) < 1000) {
          throw { status: 400, message: "Campaign budget is invalid" };
        }

        if (getCampaignRemainingBudgetValue(campaign) < costPerClick) {
          throw {
            status: 400,
            message: "Campaign does not have enough remaining budget to resume",
          };
        }

        if (walletBalance < activationRequirement) {
          throw {
            status: 400,
            message: "Insufficient marketer wallet balance to activate this campaign",
          };
        }

        campaign.exhaustedAt = undefined;
      }

      campaign.payoutModel = "pay_per_click";
      campaign.reservedBudget = 0;
      campaign.updateStatus(status, performedBy || actorId, details);
      await campaign.save({ session });

      if (status === "active") {
        await reactivateCampaignPromotions({ campaignId: campaign._id, session });
      } else if (["paused", "rejected", "completed", "expired", "exhausted"].includes(status)) {
        await deactivateCampaignPromotions({ campaignId: campaign._id, session });
      }

      responsePayload = {
        id: campaign._id,
        title: campaign.title,
        status: campaign.status,
        budget: campaign.budget,
        spentBudget: campaign.spentBudget,
        remainingBudget: getCampaignRemainingBudgetValue(campaign),
      };

      notificationPayload = {
        campaignId: String(campaign._id),
        campaignTitle: campaign.title,
        campaignBudget: campaign.budget,
        campaignSpentBudget: campaign.spentBudget,
        campaignOwnerId: String(campaign.owner),
        marketerEmail: marketer.email,
        marketerDisplayName: marketer.displayName || "Valued Marketer",
        previousStatus,
        nextStatus: status,
        details,
      };
    });

    if (notificationPayload?.marketerEmail) {
      try {
        if (shouldSendApprovalNotification(notificationPayload.previousStatus, notificationPayload.nextStatus)) {
          const emailContent = campaignApprovedTemplate({
            userName: notificationPayload.marketerDisplayName,
            campaignTitle: notificationPayload.campaignTitle,
            campaignId: notificationPayload.campaignId,
            budget: notificationPayload.campaignBudget,
          });

          await sendEmail(
            notificationPayload.marketerEmail,
            "Your Campaign Is Live - MarketSpase",
            emailContent
          );

          await NotificationService.createCampaignApprovedNotification(
            notificationPayload.campaignOwnerId,
            {
              _id: notificationPayload.campaignId,
              title: notificationPayload.campaignTitle,
              budget: notificationPayload.campaignBudget,
            }
          );
        }

        if (shouldSendRejectionNotification(notificationPayload.nextStatus)) {
          const emailContent = campaignRejectedTemplate({
            userName: notificationPayload.marketerDisplayName,
            campaignTitle: notificationPayload.campaignTitle,
            budget: notificationPayload.campaignBudget,
            refundAmount: Math.max(
              Number(notificationPayload.campaignBudget || 0) -
                Number(notificationPayload.campaignSpentBudget || 0),
              0
            ),
            rejectionReason:
              notificationPayload.details || "Your campaign did not meet our guidelines.",
          });

          await sendEmail(
            notificationPayload.marketerEmail,
            "Campaign Not Approved - MarketSpase",
            emailContent
          );

          await NotificationService.createCampaignRejectedNotification(
            notificationPayload.campaignOwnerId,
            {
              _id: notificationPayload.campaignId,
              title: notificationPayload.campaignTitle,
              budget: notificationPayload.campaignBudget,
            },
            notificationPayload.details
          );
        }
      } catch (notificationError) {
        console.error("Campaign status notification failure:", notificationError);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Campaign status updated to '${status}'`,
      data: responsePayload,
    });
  } catch (error) {
    console.error("UpdateCampaignStatus error:", error);

    return res.status(error?.status ?? 500).json({
      success: false,
      message: error?.message || "Failed to update campaign status",
      error: process.env.NODE_ENV === "development" ? error?.stack : undefined,
    });
  } finally {
    session.endSession();
  }
};
