import { CampaignModel } from "../models/campaign.model.js";
import {
  buildCampaignDraftInput,
  scheduleCampaignCreationSideEffects,
} from "../services/campaign-creation.service.js";

export const saveCampaign = async (req, res) => {
  try {
    const { campaignData } = await buildCampaignDraftInput({
      req,
      status: "draft",
      enforceWalletBalance: false,
    });

    const campaign = await CampaignModel.create(campaignData);

    scheduleCampaignCreationSideEffects({
      campaign,
      userId: req.userId,
      includeGamification: false,
      adminSubject: "New Campaign Created As Draft",
    });

    return res.status(201).json({
      success: true,
      message: "Campaign created successfully as draft.",
      data: campaign,
    });
  } catch (error) {
    const status = error.status || 400;
    console.error("Save campaign error:", error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to create campaign",
    });
  }
};
