import mongoose from "mongoose";
import { CampaignModel } from "../models/campaign.model.js";
import { UserModel } from "../../user/models/user/index.js";
import {
  getCampaignCostPerClickValue,
  getCampaignRemainingBudgetValue,
  reactivateCampaignPromotions,
} from "../services/campaign-runtime.service.js";

const ADMIN_ROLES = new Set(["admin", "super-admin"]);
const MINIMUM_TOP_UP_AMOUNT = Number(process.env.MIN_CAMPAIGN_TOP_UP_AMOUNT ?? 1000);
const NON_TOP_UP_STATUSES = new Set(["completed", "expired", "rejected"]);

export const topUpCampaign = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { campaignId } = req.params;
    const { amount, performedBy } = req.body;

    if (!campaignId || !mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({
        success: false,
        message: "Valid campaign ID is required",
      });
    }

    const topUpAmount = Number(amount);
    if (!Number.isFinite(topUpAmount) || topUpAmount < MINIMUM_TOP_UP_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: `Top-up amount must be at least ${MINIMUM_TOP_UP_AMOUNT}`,
      });
    }

    const actorId = req.userId || performedBy;
    const isAdmin = ADMIN_ROLES.has(String(req.user?.role || "").toLowerCase());

    if (!actorId) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required to top up a campaign",
      });
    }

    let resultPayload = null;

    await session.withTransaction(async () => {
      const campaign = await CampaignModel.findById(campaignId).session(session);

      if (!campaign) {
        throw { status: 404, message: "Campaign not found" };
      }

      const isOwner = String(campaign.owner) === String(actorId);
      if (!isAdmin && !isOwner) {
        throw { status: 403, message: "You are not authorized to top up this campaign" };
      }

      if (NON_TOP_UP_STATUSES.has(String(campaign.status || ""))) {
        throw {
          status: 400,
          message: `Campaigns in '${campaign.status}' state cannot be topped up`,
        };
      }

      const marketer = await UserModel.findById(campaign.owner)
        .session(session)
        .select("wallets.marketer.balance");

      if (!marketer) {
        throw { status: 404, message: "Campaign owner not found" };
      }

      const marketerBalance = Number(marketer.wallets?.marketer?.balance ?? 0);
      if (marketerBalance < topUpAmount) {
        throw {
          status: 400,
          message: "Insufficient marketer wallet balance for this campaign top-up",
        };
      }

      const previousStatus = String(campaign.status || "");
      campaign.budget = Number(campaign.budget || 0) + topUpAmount;
      campaign.reservedBudget = 0;

      let reactivated = false;
      const costPerClick = getCampaignCostPerClickValue(campaign);
      const remainingBudget = getCampaignRemainingBudgetValue(campaign);
      const endDatePassed =
        campaign.hasEndDate &&
        campaign.endDate &&
        new Date(campaign.endDate).getTime() <= Date.now();

      if (
        previousStatus === "exhausted" &&
        !endDatePassed &&
        remainingBudget >= costPerClick
      ) {
        campaign.status = "active";
        campaign.exhaustedAt = undefined;
        reactivated = true;
      }

      campaign.activityLog.push({
        action: "Campaign Topped Up",
        details: `Budget increased by ${campaign.currency || "NGN"} ${topUpAmount.toLocaleString()}.`,
        timestamp: new Date(),
        performedBy: actorId,
      });

      if (reactivated) {
        campaign.activityLog.push({
          action: "Campaign Reactivated",
          details: "Campaign resumed automatically after budget top-up.",
          timestamp: new Date(),
          performedBy: actorId,
        });
      }

      await campaign.save({ session });

      if (reactivated) {
        await reactivateCampaignPromotions({ campaignId: campaign._id, session });
      }

      resultPayload = {
        id: campaign._id,
        title: campaign.title,
        status: campaign.status,
        budget: campaign.budget,
        spentBudget: campaign.spentBudget,
        remainingBudget: getCampaignRemainingBudgetValue(campaign),
        reactivated,
        topUpAmount,
      };
    });

    return res.status(200).json({
      success: true,
      message: resultPayload?.reactivated
        ? "Campaign topped up and reactivated successfully"
        : "Campaign budget updated successfully",
      data: resultPayload,
    });
  } catch (error) {
    console.error("Top-up campaign error:", error);

    return res.status(error?.status ?? 500).json({
      success: false,
      message: error?.message || "Failed to top up campaign",
    });
  } finally {
    session.endSession();
  }
};
