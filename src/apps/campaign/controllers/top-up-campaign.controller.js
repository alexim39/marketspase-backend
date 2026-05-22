import { TopUpCampaignUseCase } from "../application/use-cases/top-up-campaign.use-case.js";
import { MongooseCampaignRepository } from "../infrastructure/repositories/mongoose-campaign.repository.js";
import { MongooseMarketerWalletRepository } from "../infrastructure/repositories/mongoose-marketer-wallet.repository.js";

const topUpCampaignUseCase = new TopUpCampaignUseCase({
  campaignRepository: new MongooseCampaignRepository(),
  marketerWalletRepository: new MongooseMarketerWalletRepository(),
});

export const topUpCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { amount, performedBy } = req.body;
    const actorId = req.userId || performedBy;
    const actorRole = req.user?.role;

    const result = await topUpCampaignUseCase.execute({
      campaignId,
      amount,
      actorId,
      actorRole,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Top-up campaign error:", error);

    return res.status(error?.status ?? error?.statusCode ?? 500).json({
      success: false,
      message: error?.message || "Failed to top up campaign",
    });
  }
};
