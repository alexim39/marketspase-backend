import { CampaignModel } from "../models/campaign.model.js";
import {
  buildCampaignDraftInput,
  scheduleCampaignCreationSideEffects,
} from "../services/campaign-creation.service.js";

export const createCampaign = async (req, res) => {
  try {
    const { campaignData } = await buildCampaignDraftInput({
      req,
      status: "pending",
      enforceWalletBalance: true,
    });

    const campaign = await CampaignModel.create(campaignData);

    scheduleCampaignCreationSideEffects({
      campaign,
      userId: req.userId,
      includeGamification: true,
      adminSubject: "New Campaign Pending Approval",
    });

    return res.status(201).json({
      success: true,
      message: "Campaign created successfully and pending approval.",
      data: campaign,
    });
  } catch (error) {
    const status = error.status || 400;
    console.error("Create campaign error:", error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to create campaign",
    });
  }
};
