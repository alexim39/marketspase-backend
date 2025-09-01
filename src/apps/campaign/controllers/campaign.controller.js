import { CampaignModel } from "../models/campaign.model.js";
import { PromotionModel } from "../models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";
import mongoose from "mongoose";

/**
 * @description Creates a new campaign. This function handles the validation,
 * reserves the campaign budget from the user's wallet, and securely saves
 * the new campaign to the database using a transaction.
 * @param {object} req - The request object from Express.js.
 * @param {object} res - The response object from Express.js.
 * @returns {Promise<void>}
 */
/* export const createCampaign = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      owner,
      title,
      caption,
      link,
      category,
      budget,
      startDate,
      endDate,
      currency,
    } = req.body;

    console.log("Received campaign creation request:", req.body);

    // Handle uploaded file
    let mediaUrl = '';
    if (req.file) {
      // Build a public URL for the uploaded file
      mediaUrl = `/uploads/campaigns/${req.file.filename}`;
    }

    const payoutPerPromotion = 200; 
    const maxPromoters = Math.floor(budget / payoutPerPromotion);

    if (!owner || !title || !budget) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Missing required fields.",
        success: false,
      });
    }

    const user = await UserModel.findById(owner).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        message: "User not found.",
        success: false,
      });
    }

    const advertiserWallet = user.wallets.advertiser;
    if (advertiserWallet.balance < budget) {
      await session.abortTransaction();
      session.endSession();
      return res.status(402).json({
        message: "Insufficient funds. Please fund your wallet to create this campaign.",
        success: false,
      });
    }

    const newCampaign = new CampaignModel({
      owner,
      title,
      caption,
      link,
      category,
      budget,
      payoutPerPromotion,
      maxPromoters,
      startDate,
      endDate,
      mediaUrl,
      currency,
      status: "pending", 
      activityLog: [{ action: 'Campaign Created', details: 'Initial campaign creation.' }],
    });

    advertiserWallet.balance = Number(advertiserWallet.balance) - Number(budget);
    advertiserWallet.reserved = Number(advertiserWallet.reserved) + Number(budget);
    advertiserWallet.transactions.push({
      amount: budget,
      type: "debit",
      category: "campaign",
      description: `Funds reserved for campaign: "${title}"`,
      relatedCampaign: newCampaign._id,
      status: "pending",
    });

    await newCampaign.save({ session });
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      message: "Campaign created successfully. Funds have been reserved and it is now awaiting review.",
      success: true,
      campaignId: newCampaign._id,
      mediaUrl: mediaUrl ? `${req.protocol}://${req.get('host')}${mediaUrl}` : null,
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating campaign:", error.message);

    res.status(500).json({
      message: "Error occurred while creating campaign.",
      success: false,
      error: error.message,
    });
  }
};
 */

/**
 * @description Creates a new campaign. This function handles the validation,
 * reserves the campaign budget from the user's wallet, and securely saves
 * the new campaign to the database using a transaction.
 * @param {object} req - The request object from Express.js.
 * @param {object} res - The response object from Express.js.
 * @returns {Promise<void>}
 */
export const createCampaign = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      owner,
      title,
      caption,
      link,
      category,
      budget,
      startDate,
      endDate,
      currency,
    } = req.body;

   // console.log("Received campaign creation request:", req.body);

    // Handle uploaded file and determine media type
    let mediaUrl = '';
    let mediaType = ''; // Initialize mediaType
    if (req.file) {
      // Build a public URL for the uploaded file
      mediaUrl = `/uploads/campaigns/${req.file.filename}`;

      // --- NEW LOGIC: Determine media type from file mimetype ---
      if (req.file.mimetype.startsWith('image/')) {
        mediaType = 'image';
      } else if (req.file.mimetype.startsWith('video/')) {
        mediaType = 'video';
      }
      // --------------------------------------------------------
    }

    const payoutPerPromotion = 200;
    const maxPromoters = Math.floor(budget / payoutPerPromotion);

    if (!owner || !title || !budget) {
      // If a file was uploaded but an error occurred, delete it to prevent orphaned files
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Missing required fields.",
        success: false,
      });
    }

    // New validation: mediaUrl is required for a campaign
    if (!mediaUrl) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Campaign media (image or video) is required.",
        success: false,
      });
    }

    const user = await UserModel.findById(owner).session(session);
    if (!user) {
      // Delete the file if the user is not found
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        message: "User not found.",
        success: false,
      });
    }

    const advertiserWallet = user.wallets.advertiser;
    if (advertiserWallet.balance < budget) {
      // Delete the file if funds are insufficient
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      await session.abortTransaction();
      session.endSession();
      return res.status(402).json({
        message: "Insufficient funds. Please fund your wallet to create this campaign.",
        success: false,
      });
    }

    const newCampaign = new CampaignModel({
      owner,
      title,
      caption,
      link,
      category,
      budget,
      payoutPerPromotion,
      maxPromoters,
      startDate,
      endDate,
      mediaUrl,
      mediaType,
      currency,
      status: "pending",
      activityLog: [{ action: 'Campaign Created', details: 'Initial campaign creation.' }],
    });

    advertiserWallet.balance = Number(advertiserWallet.balance) - Number(budget);
    advertiserWallet.reserved = Number(advertiserWallet.reserved) + Number(budget);
    advertiserWallet.transactions.push({
      amount: budget,
      type: "debit",
      category: "campaign",
      description: `Funds reserved for campaign: "${title}"`,
      relatedCampaign: newCampaign._id,
      status: "pending",
    });

    await newCampaign.save({ session });
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      message: "Campaign created successfully. Funds have been reserved and it is now awaiting review.",
      success: true,
      campaignId: newCampaign._id,
      mediaUrl: mediaUrl ? `${req.protocol}://${req.get('host')}${mediaUrl}` : null,
      mediaType: mediaType,
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating campaign:", error.message);

    // Clean up the uploaded file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      message: "Error occurred while creating campaign.",
      success: false,
      error: error.message,
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
export const getAllUserCampaigns = async (req, res) => {
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
export const getCampaignsByStatus = async (req, res) => {
  try {
    const { status } = req.query;

    let query = {};
    if (status) {
      query.status = status;
    }

    const campaigns = await CampaignModel.find(query).sort({ createdAt: -1 });

    if (!campaigns || campaigns.length === 0) {
      return res.status(404).json({
        success: false,
        message: status
          ? `No campaigns found with status "${status}".`
          : "No campaigns found.",
      });
    }

    res.status(200).json({
      success: true,
      data: campaigns,
      message: status
        ? `Campaigns with status "${status}" fetched successfully.`
        : "All campaigns fetched successfully.",
    });
  } catch (error) {
    console.error("Error fetching campaigns by status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch campaigns.",
      error: error.message,
    });
  }
};

// In your backend campaign controller
export const applyForCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { userId } = req.body;

    // Find campaign
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Check if campaign is active
    if (campaign.status !== 'active') {
      return res.status(400).json({ message: 'Campaign is not active' });
    }

    // Check if user has already applied
    const existingPromotion = await PromotionModel.findOne({
      campaign: campaignId,
      promoter: userId
    });

    if (existingPromotion) {
      return res.status(400).json({ message: 'You have already applied for this campaign' });
    }

    // Check if campaign can accept more promoters
    if (!campaign.canAssignPromoter()) {
      return res.status(400).json({ message: 'Campaign is full or budget exhausted' });
    }

    // Start transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create promotion record
      const promotion = new PromotionModel({
        campaign: campaignId,
        promoter: userId,
        status: 'pending',
        payoutAmount: campaign.payoutPerPromotion
      });

      await promotion.save({ session });

      // Update campaign stats
      campaign.totalPromotions += 1;
      campaign.currentPromoters += 1;
      campaign.spentBudget += campaign.payoutPerPromotion;

      // Check if campaign should be marked as exhausted
      if (campaign.totalPromotions >= campaign.maxPromoters || 
          campaign.spentBudget >= campaign.budget) {
        campaign.status = 'exhausted';
      }

      await campaign.save({ session });

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      res.json({ 
        success: true,
        message: 'Successfully applied for campaign',
        promotion: promotion 
      });

    } catch (error) {
      // Rollback transaction on error
      await session.abortTransaction();
      session.endSession();
      throw error;
    }

  } catch (error) {
    console.error('Error applying for campaign:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
