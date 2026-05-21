import mongoose from "mongoose";
import {
  getCampaignCostPerClickValue,
  getCampaignRemainingBudgetValue,
  reactivateCampaignPromotions,
} from "../../services/campaign-runtime.service.js";

const ADMIN_ROLES = new Set(["admin", "super-admin"]);
const MINIMUM_TOP_UP_AMOUNT = Number(process.env.MIN_CAMPAIGN_TOP_UP_AMOUNT ?? 1000);
const NON_TOP_UP_STATUSES = new Set(["completed", "expired", "rejected"]);

const createStatusError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

export class TopUpCampaignUseCase {
  constructor({ campaignRepository, marketerWalletRepository } = {}) {
    this.campaignRepository = campaignRepository;
    this.marketerWalletRepository = marketerWalletRepository;
  }

  async execute({ campaignId, amount, actorId, actorRole } = {}) {
    if (!campaignId || !mongoose.Types.ObjectId.isValid(campaignId)) {
      throw createStatusError(400, "Valid campaign ID is required");
    }

    const topUpAmount = Number(amount);
    if (!Number.isFinite(topUpAmount) || topUpAmount < MINIMUM_TOP_UP_AMOUNT) {
      throw createStatusError(400, `Top-up amount must be at least ${MINIMUM_TOP_UP_AMOUNT}`);
    }

    if (!actorId) {
      throw createStatusError(401, "Authentication is required to top up a campaign");
    }

    if (!this.campaignRepository || !this.marketerWalletRepository) {
      throw createStatusError(500, "Top-up campaign use case is not configured");
    }

    const isAdmin = ADMIN_ROLES.has(String(actorRole || "").toLowerCase());

    const session = await mongoose.startSession();
    try {
      let resultPayload = null;

      await session.withTransaction(async () => {
        const campaign = await this.campaignRepository.findById(campaignId, { session });

        if (!campaign) {
          throw createStatusError(404, "Campaign not found");
        }

        const isOwner = String(campaign.owner) === String(actorId);
        if (!isAdmin && !isOwner) {
          throw createStatusError(403, "You are not authorized to top up this campaign");
        }

        if (NON_TOP_UP_STATUSES.has(String(campaign.status || ""))) {
          throw createStatusError(
            400,
            `Campaigns in '${campaign.status}' state cannot be topped up`
          );
        }

        const marketer = await this.marketerWalletRepository.getMarketerBalance(campaign.owner, { session });
        if (!marketer) {
          throw createStatusError(404, "Campaign owner not found");
        }

        const marketerBalance = Number(marketer.wallets?.marketer?.balance ?? 0);
        if (marketerBalance < topUpAmount) {
          throw createStatusError(400, "Insufficient marketer wallet balance for this campaign top-up");
        }

        const previousStatus = String(campaign.status || "");

        // Defensive: some older/buggy flows have allowed counters to drift negative.
        // A normal `save()` validates the whole document, so these legacy invalid values
        // can block unrelated operations like top-ups.
        if (Number(campaign.currentPromoters) < 0) {
          campaign.currentPromoters = 0;
        }
        if (Number(campaign.totalPromotions) < 0) {
          campaign.totalPromotions = 0;
        }
        if (Number(campaign.validatedPromotions) < 0) {
          campaign.validatedPromotions = 0;
        }
        if (Number(campaign.paidPromotions) < 0) {
          campaign.paidPromotions = 0;
        }
        if (Number(campaign.rejectedPromotions) < 0) {
          campaign.rejectedPromotions = 0;
        }

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

        if (!Array.isArray(campaign.activityLog)) {
          campaign.activityLog = [];
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

        // Validate only the fields we actually touched, to avoid unrelated legacy
        // invalid fields (e.g. negative counters) blocking a top-up.
        await campaign.save({ session, validateModifiedOnly: true });

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

      return {
        success: true,
        message: resultPayload?.reactivated
          ? "Campaign topped up and reactivated successfully"
          : "Campaign budget updated successfully",
        data: resultPayload,
      };
    } finally {
      session.endSession();
    }
  }
}

