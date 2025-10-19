import { CampaignModel } from "../models/campaign.model.js";


/**
 * Controller to get all campaigns.
 * It populates the 'owner' field to include user data and also
 * populates the 'promotions' virtual to include promotion data for each campaign.
 * It returns the campaigns sorted by creation date in descending order (newest first).
 */
export const getAllCampaigns = async (req, res) => {
  try {
    // 1. Find all campaigns
    const campaigns = await CampaignModel.find({})
      // 2. Sort the results. The '-createdAt' sorts by the 'createdAt' field in descending order.
      .sort("-createdAt") 
      // 3. Populate the 'owner' field with user details
      .populate({
        path: "owner",
        select: "displayName username email avatar uid", // Specify which fields to include
      })
      // 4. Populate the 'promotions' virtual field
      .populate({
        path: "promotions",
        select: "promoter views screenshotUrl status", // Specify which fields to include from promotions
      })
      .exec();

    // 5. Send a success response with the fetched campaigns
    res.status(200).json({
      success: true,
      message: "Campaigns fetched successfully.",
      data: campaigns,
    });
  } catch (error) {
    // 6. Handle any errors that occur during the database query
    console.error("Error fetching campaigns:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching campaigns.",
    });
  }
};