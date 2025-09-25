import { CampaignModel } from "../models/campaign.model.js";
import { PromotionModel } from "../models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";
import mongoose from "mongoose";
import fs from "fs"; // Add this import
import path from "path"; // Useful for path operations


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



/**
 * @description Fetches all campaigns owned by a specific user.
 * This function uses a read-only database query and does not require a transaction.
 * @param {object} req - The request object from Express.js, expected to contain the user ID.
 * @param {object} res - The response object from Express.js.
 * @returns {Promise<void>}
 */
export const getAUserCampaigns = async (req, res) => {
  // We don't need a transaction for a read operation, as no data will be modified.
  try {
    // The user's ID is typically attached to the request object by an authentication middleware.
    // Assuming the user ID is available from `req.user.id` after authentication.
    // If you are using a different approach (e.g., from a URL parameter), adjust this line.
    const {userId} = req.params; 

    // Validate that the user ID is present.
    if (!userId) {
      return res.status(400).json({
        message: "User ID is required.",
        success: false,
      });
    }

    // Find all campaigns where the 'owner' field matches the provided userId.
    // We sort the results by creation date in descending order to show the newest campaigns first.
    // const campaigns = await CampaignModel.find({ owner: userId }).sort({
    //   createdAt: -1,
    // });

     // Populate promotions for each campaign
    const campaigns = await CampaignModel.find({ owner: userId })
      .sort({ createdAt: -1 })
      .populate({
        path: 'promotions', // This should match your virtual field name in the Campaign model
        model: 'Promotion'
      });

    // Check if any campaigns were found.
    if (!campaigns || campaigns.length === 0) {
      return res.status(404).json({
        message: "No campaigns found for this user.",
        success: false,
      });
    }

    // Return the found campaigns with a success message.
    return res.status(200).json({
      message: "Campaigns retrieved successfully.",
      success: true,
      data: campaigns,
    });
  } catch (error) {
    // Log the error for debugging purposes.
    console.error("Error retrieving user campaigns:", error.message);

    // Return a 500 status code for internal server errors.
    res.status(500).json({
      message: "An error occurred while retrieving campaigns.",
      success: false,
      error: error.message,
    });
  }
};



/**
 * Get campaigns by status (e.g., active, paused, completed, etc.).
 * If no status is provided, returns all campaigns.
 */
// export const getCampaignsByStatus = async (req, res) => {
//   try {
//     const { status } = req.query;

//     let query = {};
//     if (status) {
//       query.status = status;
//     }

//     const campaigns = await CampaignModel.find(query).sort({ createdAt: -1 });

//     if (!campaigns || campaigns.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: status
//           ? `No campaigns found with status "${status}".`
//           : "No campaigns found.",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       data: campaigns,
//       message: status
//         ? `Campaigns with status "${status}" fetched successfully.`
//         : "All campaigns fetched successfully.",
//     });
//   } catch (error) {
//     console.error("Error fetching campaigns by status:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch campaigns.",
//       error: error.message,
//     });
//   }
// };



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