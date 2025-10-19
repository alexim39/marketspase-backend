import { CampaignModel } from "../models/campaign.model.js";


/**
 * Controller to get a single campaign by its ID.
 * It populates the 'owner' field with all user data (excluding the password)
 * and the 'promotions' virtual with all promotion data, including the promoter details.
 */
export const getCampaignById = async (req, res) => {
  try {
    // 1. Extract the campaign ID from the request parameters
    const { id } = req.params;

    // 2. Validate that the ID is provided
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Campaign ID is required.",
      });
    }

    // 3. Find the campaign by its ID
    const campaign = await CampaignModel.findById(id)
      // 4. Populate the 'owner' field with all user details, excluding the password.
      .populate({
        path: "owner",
        select: "-password",
      })
      // 5. Populate the 'promotions' virtual field and then populate the 'promoter' field within each promotion.
      .populate({
        path: "promotions",
        // Nested populate to get the promoter details
        populate: {
          path: "promoter",
          select: "-password", // Exclude password from the promoter's details
        },
      })
      .exec();

    // 6. Handle the case where the campaign is not found
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found.",
      });
    }

    // 7. Send a success response with the campaign data
    res.status(200).json({
      success: true,
      message: "Campaign fetched successfully.",
      data: campaign,
    });
  } catch (error) {
    // 8. Handle errors, such as an invalid ID format
    console.error("Error fetching campaign by ID:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign ID format.",
      });
    }
    // 9. Handle other generic server errors
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching the campaign.",
    });
  }
};