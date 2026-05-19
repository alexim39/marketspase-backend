import { resolveCampaignMediaAsset } from "../services/campaign-creation.service.js";

export const uploadCampaignMedia = async (req, res) => {
  try {
    const mediaAsset = await resolveCampaignMediaAsset({
      req,
      owner: req.userId,
      requireMedia: true,
      allowExistingMedia: false,
    });

    return res.status(201).json({
      success: true,
      message: "Campaign media uploaded successfully.",
      data: mediaAsset,
    });
  } catch (error) {
    const status = error.status || 400;
    console.error("Upload campaign media error:", error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to upload campaign media.",
    });
  }
};
