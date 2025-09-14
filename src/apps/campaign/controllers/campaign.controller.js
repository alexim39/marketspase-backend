import { CampaignModel } from "../models/campaign.model.js";
import { PromotionModel } from "../models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";
import mongoose from "mongoose";
import fs from "fs"; // Add this import
import path from "path"; // Useful for path operations


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
      enableTarget,
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

    const marketerWallet = user.wallets.marketer;
    if (marketerWallet.balance < budget) {
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
      enableTarget,
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

    marketerWallet.balance = Number(marketerWallet.balance) - Number(budget);
    marketerWallet.reserved = Number(marketerWallet.reserved) + Number(budget);
    marketerWallet.transactions.push({
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
}; */


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

  // Helper function to safely delete files
  const deleteUploadedFile = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.error("Error deleting file:", error.message);
      }
    }
  };

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
      enableTarget,
      campaignType = "standard",
      priority = "medium",
      minRating = 0,
      requirements = "",
      targetLocations = [],
      hasEndDate = true,
      minViewsPerPromotion = 25
    } = req.body;

    // Handle uploaded file and determine media type
    let mediaUrl = '';
    let mediaType = '';
    if (req.file) {
      // Build a public URL for the uploaded file
      mediaUrl = `/uploads/campaigns/${req.file.filename}`;

      // Determine media type from file mimetype
      if (req.file.mimetype.startsWith('image/')) {
        mediaType = 'image';
      } else if (req.file.mimetype.startsWith('video/')) {
        mediaType = 'video';
      }
    }

    const payoutPerPromotion = 200;
    const maxPromoters = Math.floor(budget / payoutPerPromotion);

    // Validate required fields
    if (!owner || !title || !budget || !category) {
      deleteUploadedFile(req.file?.path);
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Missing required fields: owner, title, budget, and category are required.",
        success: false,
      });
    }

    // Validate media is provided
    if (!mediaUrl) {
      deleteUploadedFile(req.file?.path);
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Campaign media (image or video) is required.",
        success: false,
      });
    }

    const user = await UserModel.findById(owner).session(session);
    if (!user) {
      deleteUploadedFile(req.file?.path);
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        message: "User not found.",
        success: false,
      });
    }

    const marketerWallet = user.wallets.marketer;
    if (marketerWallet.balance < budget) {
      deleteUploadedFile(req.file?.path);
      await session.abortTransaction();
      session.endSession();
      return res.status(402).json({
        message: "Insufficient funds. Please fund your wallet to create this campaign.",
        success: false,
      });
    }

    // Process requirements array if provided as string
    const requirementsArray = requirements 
      ? requirements.split(',').map(req => req.trim()).filter(req => req.length > 0)
      : [];

    // Process target locations
    const targetLocationsArray = Array.isArray(targetLocations) 
      ? targetLocations 
      : (typeof targetLocations === 'string' ? targetLocations.split(',').map(loc => loc.trim()) : []);

    const newCampaign = new CampaignModel({
      owner,
      title,
      caption: caption || "",
      link: link || "",
      category,
      budget: Number(budget),
      enableTarget: Boolean(enableTarget),
      targetLocations: targetLocationsArray,
      requirements: requirementsArray,
      minRating: Number(minRating),
      campaignType,
      priority,
      hasEndDate: Boolean(hasEndDate),
      minViewsPerPromotion: Number(minViewsPerPromotion),
      payoutPerPromotion,
      maxPromoters,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : undefined,
      mediaUrl,
      mediaType,
      currency: currency || "NGN",
      status: "pending",
      createdBy: owner,
      activityLog: [{ 
        action: 'Campaign Created', 
        details: 'Initial campaign creation.',
        performedBy: owner
      }],
    });

    // Reserve budget from marketer wallet
    marketerWallet.balance = Number(marketerWallet.balance) - Number(budget);
    marketerWallet.reserved = Number(marketerWallet.reserved) + Number(budget);
    marketerWallet.transactions.push({
      amount: budget,
      type: "debit",
      category: "campaign",
      description: `Funds reserved for campaign: "${title}"`,
      relatedCampaign: newCampaign._id,
      status: "reserved",
    });

    await newCampaign.save({ session });
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "Campaign created successfully. Funds have been reserved and it is now awaiting review.",
      success: true,
      campaignId: newCampaign._id,
      mediaUrl: mediaUrl ? `${req.protocol}://${req.get('host')}${mediaUrl}` : null,
      mediaType: mediaType,
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    // Clean up the uploaded file on error
    deleteUploadedFile(req.file?.path);

    console.error("Error creating campaign:", error.message);

    // Handle specific MongoDB connection errors
    if (error.code === 'EAI_AGAIN') {
      return res.status(503).json({
        message: "Database connection error. Please try again later.",
        success: false,
        error: "Database unavailable"
      });
    }

    res.status(500).json({
      message: "Error occurred while creating campaign.",
      success: false,
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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


/**
 * @description Allows a promoter to accept a campaign, creating a promotion record
 * and securely updating the reserved funds in both the marketer's and promoter's
 * wallets using a database transaction.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @returns {Promise<void>}
 */
/* export const acceptCampaign = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { campaignId } = req.params;
    const { userId } = req.body;

    // 1. Find the campaign and the promoter within the transaction
    const campaign = await CampaignModel.findById(campaignId).session(session);
    const promoter = await UserModel.findById(userId).session(session);

    // 2. Initial validation
    if (!campaign) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    if (!promoter) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Promoter user not found' });
    }
    if (campaign.status !== 'active') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Campaign is not active' });
    }

    // 3. Check for existing promotion record
    const existingPromotion = await PromotionModel.findOne({
      campaign: campaignId,
      promoter: userId
    }).session(session);
    if (existingPromotion) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'You have already accepted this campaign' });
    }

    // 4. Check if campaign can accept more promoters
    // Assuming canAssignPromoter is a method on the Campaign model
    if (!campaign.canAssignPromoter()) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Campaign is full or budget exhausted' });
    }

    const payoutAmount = campaign.payoutPerPromotion;
    const marketer = await UserModel.findById(campaign.owner).session(session);

    if (!marketer) {
      await session.abortTransaction();
      return res.status(500).json({ success: false, message: 'Campaign owner not found.' });
    }

    // 5. Create promotion record with the session first to get its _id
    const promotion = new PromotionModel({
      campaign: campaignId,
      promoter: userId,
      status: 'pending',
      payoutAmount: payoutAmount
    });
    await promotion.save({ session });
    

    // 6. Update wallet balances within the transaction
    // Deduct from marketer's reserved wallet
    marketer.wallets.marketer.reserved = (marketer.wallets.marketer.reserved || 0) - payoutAmount;
    marketer.wallets.marketer.transactions.push({
      amount: payoutAmount,
      type: "debit",
      category: "campaign",
      description: `Funds transferred to promoter for campaign: "${campaign.title}"`,
      relatedCampaign: campaignId,
      status: "successful",
    });

    // Credit promoter's reserved wallet
    promoter.wallets.promoter.reserved = (promoter.wallets.promoter.reserved || 0) + payoutAmount;
    promoter.wallets.promoter.transactions.push({
      amount: payoutAmount,
      type: "credit",
      category: "promotion",
      description: `Funds reserved from campaign: "${campaign.title}"`,
      relatedCampaign: campaignId,
      relatedPromotion: promotion._id,
      status: "successful",
    });


    // 7. Update campaign stats with the session
    campaign.totalPromotions += 1;
    campaign.currentPromoters += 1;

    // Check if the campaign should be marked as exhausted based on the new count
    if (campaign.totalPromotions >= campaign.maxPromoters) {
      campaign.status = 'exhausted';
    }

    // 8. Save all documents
    await marketer.save({ session });
    await promoter.save({ session });
    await campaign.save({ session });
    
    // 9. Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // 10. Send success response
    res.json({
      success: true,
      message: 'Promotion accepted. Funds have been reserved for you. Check your promotion page to submit completion proof.',
      promotion: promotion
    });

  } catch (error) {
    // 11. Rollback transaction on error
    await session.abortTransaction();
    session.endSession();
    console.error('Error accepting campaign:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}; */



/**
 * @description Allows a promoter to accept a campaign, creating a promotion record
 * and securely updating the reserved funds in both the marketer's and promoter's
 * wallets using a database transaction.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @returns {Promise<void>}
 */
export const acceptCampaign = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { campaignId } = req.params;
    const { userId } = req.body;

    // 1. Find the campaign and the promoter within the transaction
    const campaign = await CampaignModel.findById(campaignId).session(session);
    const promoter = await UserModel.findById(userId).session(session);

    // 2. Initial validation
    if (!campaign) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    if (!promoter) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Promoter user not found' });
    }
    if (campaign.status !== 'active') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Campaign is not active' });
    }

    // 3. Check for existing promotion record
    const existingPromotion = await PromotionModel.findOne({
      campaign: campaignId,
      promoter: userId
    }).session(session);
    if (existingPromotion) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'You have already accepted this campaign' });
    }

    // 4. Check if campaign can accept more promoters
    if (!campaign.canAssignPromoter()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Campaign is full or budget exhausted' });
    }

    const payoutAmount = campaign.payoutPerPromotion;
    //const marketer = await UserModel.findById(campaign.owner).session(session);

    // if (!marketer) {
    //   await session.abortTransaction();
    //   session.endSession();
    //   return res.status(500).json({ success: false, message: 'Campaign owner not found.' });
    // }

    // 5. Create promotion record with the session first to get its _id
    const promotion = new PromotionModel({
      campaign: campaignId,
      promoter: userId,
      status: 'pending',
      payoutAmount: payoutAmount
    });
    await promotion.save({ session });
    

    // 6. Update wallet balances within the transaction
    // Deduct from marketer's reserved wallet
    // marketer.wallets.marketer.reserved = (marketer.wallets.marketer.reserved || 0) - payoutAmount;
    // marketer.wallets.marketer.transactions.push({
    //   amount: payoutAmount,
    //   type: "debit",
    //   category: "campaign",
    //   description: `Funds transferred to promoter for campaign: "${campaign.title}"`,
    //   relatedCampaign: campaignId,
    //   status: "successful",
    // });

    // Credit promoter's reserved wallet
    // promoter.wallets.promoter.reserved = (promoter.wallets.promoter.reserved || 0) + payoutAmount;
    // promoter.wallets.promoter.transactions.push({
    //   amount: payoutAmount,
    //   type: "credit",
    //   category: "promotion",
    //   description: `Funds reserved from campaign: "${campaign.title}"`,
    //   relatedCampaign: campaignId,
    //   relatedPromotion: promotion._id,
    //   status: "successful",
    // });

    // 7. Update campaign using the assignPromoter method
    //campaign.assignPromoter();
    
    // IMPORTANT: Update spentBudget to reflect the reserved funds
    // This ensures the campaign budget tracking is accurate
    //campaign.spentBudget += payoutAmount;
    
    // Check if the campaign should be marked as exhausted
    // if (campaign.spentBudget >= campaign.budget || campaign.totalPromotions >= campaign.maxPromoters) {
    //   campaign.status = 'exhausted';
    //   campaign.activityLog.push({
    //     action: "Campaign Exhausted",
    //     details: `Campaign budget exhausted after ${campaign.totalPromotions} promotions`,
    //     timestamp: new Date()
    //   });
    // }

    // 8. Save all documents
    //await marketer.save({ session });
    await promoter.save({ session });
    await campaign.save({ session });
    
    // 9. Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // 10. Send success response
    res.json({
      success: true,
      message: 'Promotion accepted. Funds have been reserved for you. Check your promotion page to submit completion proof.',
      promotion: promotion,
      campaignStatus: campaign.status,
      remainingBudget: campaign.remainingBudget
    });

  } catch (error) {
    // 11. Rollback transaction on error
    await session.abortTransaction();
    session.endSession();
    console.error('Error accepting campaign:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


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
 * Controller to change the status of a campaign.
 * This function allows an admin or campaign owner to update the campaign's status.
 */
/* export const updateCampaignStatus = async (req, res) => {
  try {
    // 1. Extract the campaign ID from the request parameters
    const { id } = req.params;
    // 2. Extract the new status from the request body
    const { status } = req.body;

    // 3. Validate that both ID and status are provided
    if (!id || !status) {
      return res.status(400).json({
        success: false,
        message: "Campaign ID and new status are required.",
      });
    }

    // 4. Validate that the new status is a valid enum value
    const validStatuses = ["active", "paused", "rejected","validated", "completed", "exhausted", "expired", "pending"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status provided.",
      });
    }

    // 5. Find the campaign by ID and update its status
    const campaign = await CampaignModel.findById(id);

    // 6. Handle the case where the campaign is not found
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found.",
      });
    }

    // 7. Update the status and add a log entry
    campaign.status = status;
    campaign.activityLog.push({
      action: `Status changed to ${status}`,
      details: `Campaign status manually updated to '${status}'.`,
    });

    // 8. Save the updated campaign document
    await campaign.save();

    // 9. Send a success response
    res.status(200).json({
      success: true,
      message: `Campaign status updated to '${status}' successfully.`,
      data: {
        _id: campaign._id,
        title: campaign.title,
        status: campaign.status,
      },
    });
  } catch (error) {
    // 10. Handle errors, such as invalid ID format
    console.error("Error updating campaign status:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign ID format.",
      });
    }
    // 11. Handle other generic server errors
    res.status(500).json({
      success: false,
      message: "An error occurred while updating the campaign status.",
    });
  }
};
 */


/**
 * Controller to change the status of a campaign.
 * This function allows an admin or campaign owner to update the campaign's status.
 */
export const updateCampaignStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Extract the campaign ID from the request parameters
    const { id } = req.params;
    // 2. Extract the new status and optional details from the request body
    const { status, details = "" } = req.body;
    // 3. Get the user ID from the request (assuming it's set by authentication middleware)
    const performedBy = req.user?._id;

    // 4. Validate that both ID and status are provided
    if (!id || !status) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Campaign ID and new status are required.",
      });
    }

    // 5. Validate that the new status is a valid enum value
    const validStatuses = [
      "active", "paused", "rejected", "completed", 
      "exhausted", "expired", "pending", "draft", "validated"
    ];
    if (!validStatuses.includes(status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid status provided.",
      });
    }

    // 6. Find the campaign by ID within the transaction
    const campaign = await CampaignModel.findById(id).session(session);

    // 7. Handle the case where the campaign is not found
    if (!campaign) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Campaign not found.",
      });
    }

    // 8. Check if the status is actually changing
    if (campaign.status === status) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Campaign is already in '${status}' status.`,
      });
    }

    // 9. Use the model's updateStatus method for consistency
    campaign.updateStatus(status, performedBy, details);

    // 10. Special handling for status changes that might affect wallet balances
    if (status === "rejected" || status === "cancelled") {
      // If campaign is rejected/cancelled, refund reserved funds to marketer
      const marketer = await UserModel.findById(campaign.owner).session(session);
      if (marketer) {
        const refundAmount = campaign.budget - campaign.spentBudget;
        if (refundAmount > 0) {
          marketer.wallets.marketer.reserved -= refundAmount;
          marketer.wallets.marketer.balance += refundAmount;
          
          marketer.wallets.marketer.transactions.push({
            amount: refundAmount,
            type: "credit",
            category: "campaign_refund",
            description: `Funds refunded for ${status} campaign: "${campaign.title}"`,
            relatedCampaign: campaign._id,
            status: "successful",
          });
          
          await marketer.save({ session });
        }
      }
    }

    // 11. Save the updated campaign document within the transaction
    await campaign.save({ session });

    // 12. Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // 13. Send a success response
    res.status(200).json({
      success: true,
      message: `Campaign status updated to '${status}' successfully.`,
      data: {
        _id: campaign._id,
        title: campaign.title,
        status: campaign.status,
        remainingBudget: campaign.remainingBudget,
        spentBudget: campaign.spentBudget
      },
    });
  } catch (error) {
    // 14. Rollback transaction on error
    await session.abortTransaction();
    session.endSession();
    
    // 15. Handle errors, such as invalid ID format
    console.error("Error updating campaign status:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign ID format.",
      });
    }
    // 16. Handle other generic server errors
    res.status(500).json({
      success: false,
      message: "An error occurred while updating the campaign status.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



/**
 * @description Update an existing campaign
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
export const updateCampaign = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  // Helper function to safely delete files
  const deleteUploadedFile = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.error("Error deleting file:", error.message);
      }
    }
  };

  try {
    const { id } = req.params;
    const {
      title,
      caption,
      category,
      link,
      mediaType,
      budget,
      campaignType,
      enableTarget,
      startDate,
      endDate,
      hasEndDate,
      requirements,
      minRating,
      priority,
      targetLocations
    } = req.body;

    const {performedBy} = req.params;// User performing the update

    // Validate required fields
    if (!id) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Campaign ID is required.",
      });
    }

    if (!title || !category || !budget) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Title, category, and budget are required fields.",
      });
    }

    // Find the campaign within transaction
    const campaign = await CampaignModel.findById(id).session(session);
    if (!campaign) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Campaign not found.",
      });
    }

    // Check if user has permission to update this campaign
    if (campaign.owner.toString() !== performedBy?.toString() && req.user?.role !== 'admin') {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this campaign.",
      });
    }

    // Handle media file upload if provided
    let mediaUrl = campaign.mediaUrl;
    let newMediaType = campaign.mediaType;
    
    if (req.file) {
      // Delete old media file if it exists
      if (campaign.mediaUrl) {
        const oldFilePath = path.join(process.cwd(), campaign.mediaUrl.replace(/^\//, ''));
        deleteUploadedFile(oldFilePath);
      }

      // Build a public URL for the new file
      mediaUrl = `/uploads/campaigns/${req.file.filename}`;
      
      // Determine media type from file mimetype
      if (req.file.mimetype.startsWith('image/')) {
        newMediaType = 'image';
      } else if (req.file.mimetype.startsWith('video/')) {
        newMediaType = 'video';
      }
    }

    // Process requirements array if provided as string or array
    const requirementsArray = Array.isArray(requirements) 
      ? requirements 
      : (typeof requirements === 'string' ? requirements.split(',').map(req => req.trim()).filter(req => req.length > 0) : campaign.requirements);

    // Process target locations
    const targetLocationsArray = Array.isArray(targetLocations) 
      ? targetLocations 
      : (typeof targetLocations === 'string' ? targetLocations.split(',').map(loc => loc.trim()) : campaign.targetLocations || []);

    // Calculate new maxPromoters if budget or payout changes
    const payoutPerPromotion = campaign.payoutPerPromotion; // Keep existing payout or could make this editable
    const newMaxPromoters = Math.floor(budget / payoutPerPromotion);

    // Check if the new budget can cover existing commitments
    if (budget < campaign.spentBudget) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `New budget (${budget}) cannot be less than already spent amount (${campaign.spentBudget}).`,
      });
    }

    // Check if reducing max promoters below current promoters
    if (newMaxPromoters < campaign.currentPromoters) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `New budget allows only ${newMaxPromoters} promoters, but there are already ${campaign.currentPromoters} promoters assigned.`,
      });
    }

    // Update campaign fields
    campaign.title = title;
    campaign.caption = caption || "";
    campaign.category = category;
    campaign.link = link || "";
    campaign.mediaUrl = mediaUrl;
    campaign.mediaType = newMediaType;
    campaign.budget = Number(budget);
    campaign.campaignType = campaignType || "standard";
    campaign.enableTarget = Boolean(enableTarget);
    campaign.targetLocations = targetLocationsArray;
    campaign.requirements = requirementsArray;
    campaign.minRating = Number(minRating) || 0;
    campaign.priority = priority || "medium";
    campaign.hasEndDate = Boolean(hasEndDate);
    campaign.maxPromoters = newMaxPromoters;
    
    // Handle dates
    if (startDate) {
      campaign.startDate = new Date(startDate);
    }
    
    if (endDate && hasEndDate) {
      campaign.endDate = new Date(endDate);
    } else if (!hasEndDate) {
      campaign.endDate = undefined;
    }

    // Update activity log
    campaign.activityLog.push({
      action: "Campaign Updated",
      details: "Campaign details were modified",
      timestamp: new Date(),
      performedBy: performedBy
    });

    // Update updatedBy field
    campaign.updatedBy = performedBy;

    // Save the updated campaign
    await campaign.save({ session });

    // Handle budget adjustments if needed
    if (budget > campaign.budget) {
      // Additional funds needed - reserve from marketer's wallet
      const additionalAmount = budget - campaign.budget;
      const marketer = await UserModel.findById(campaign.owner).session(session);
      
      if (marketer.wallets.marketer.balance < additionalAmount) {
        await session.abortTransaction();
        session.endSession();
        return res.status(402).json({
          success: false,
          message: "Insufficient funds to increase campaign budget.",
        });
      }

      marketer.wallets.marketer.balance -= additionalAmount;
      marketer.wallets.marketer.reserved += additionalAmount;
      
      marketer.wallets.marketer.transactions.push({
        amount: additionalAmount,
        type: "debit",
        category: "campaign_budget_increase",
        description: `Additional funds reserved for campaign: "${campaign.title}"`,
        relatedCampaign: campaign._id,
        status: "successful",
      });

      await marketer.save({ session });
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Campaign updated successfully.",
      data: {
        _id: campaign._id,
        title: campaign.title,
        status: campaign.status,
        budget: campaign.budget,
        spentBudget: campaign.spentBudget,
        remainingBudget: campaign.remainingBudget,
        maxPromoters: campaign.maxPromoters,
        currentPromoters: campaign.currentPromoters,
        mediaUrl: mediaUrl ? `${req.protocol}://${req.get('host')}${mediaUrl}` : null,
        mediaType: newMediaType
      },
    });

  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    session.endSession();
    
    // Clean up uploaded file if error occurred
    if (req.file) {
      deleteUploadedFile(req.file.path);
    }

    console.error("Error updating campaign:", error);
    
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign ID format.",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "An error occurred while updating the campaign.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};




/**
 * @description Archive a campaign (soft delete)
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
export const archiveCampaign = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { deletionReason } = req.body;
    const performedBy = req.user?._id;

    // Validate input
    if (!id) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Campaign ID is required.",
      });
    }

    // Find the campaign within transaction
    const campaign = await CampaignModel.findById(id).session(session);
    if (!campaign) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Campaign not found.",
      });
    }

    // Check permissions
    if (campaign.owner.toString() !== performedBy?.toString() && req.user?.role !== 'admin') {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this campaign.",
      });
    }

    // Check if campaign can be archived
    if (campaign.status === 'active' && campaign.currentPromoters > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Cannot archive active campaign with promoters. Pause or cancel it first.",
      });
    }

    // Refund unused budget if campaign hasn't started
    let refundAmount = 0;
    if (campaign.status === 'draft' || campaign.status === 'pending') {
      refundAmount = campaign.budget - campaign.spentBudget;
      
      if (refundAmount > 0) {
        const marketer = await UserModel.findById(campaign.owner).session(session);
        marketer.wallets.marketer.reserved -= refundAmount;
        marketer.wallets.marketer.balance += refundAmount;
        
        marketer.wallets.marketer.transactions.push({
          amount: refundAmount,
          type: "credit",
          category: "campaign_refund",
          description: `Refund for archived campaign: "${campaign.title}"`,
          relatedCampaign: campaign._id,
          status: "successful",
        });
        
        await marketer.save({ session });
      }
    }

    // Soft delete the campaign
    campaign.status = "archived";
    campaign.isDeleted = true;
    campaign.deletedAt = new Date();
    campaign.deletedBy = performedBy;

    // Update activity log
    campaign.activityLog.push({
      action: "Campaign Archived",
      details: deletionReason 
        ? `Campaign archived. Reason: ${deletionReason}. Refunded: ${refundAmount} NGN` 
        : `Campaign archived. Refunded: ${refundAmount} NGN`,
      timestamp: new Date(),
      performedBy: performedBy
    });

    await campaign.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: refundAmount > 0 
        ? `Campaign archived successfully. ${refundAmount} NGN refunded to your wallet.`
        : "Campaign archived successfully.",
      data: {
        _id: campaign._id,
        title: campaign.title,
        refundAmount: refundAmount
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error("Error archiving campaign:", error);
    
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign ID format.",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "An error occurred while archiving the campaign.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


/**
 * @description Permanently delete a campaign (ADMIN ONLY)
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
export const deleteCampaign = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const performedBy = req.user?._id;

    // Validate admin role
    if (req.user?.role !== 'admin') {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "Only administrators can permanently delete campaigns.",
      });
    }

    // Find the campaign and populate related data
    const campaign = await CampaignModel.findById(id)
      .populate('promotions')
      .session(session);

    if (!campaign) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Campaign not found.",
      });
    }

    // Safety checks - prevent deletion of campaigns with activity
    if (campaign.currentPromoters > 0 || campaign.spentBudget > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Cannot delete campaign with active promoters or financial activity.",
      });
    }

    if (campaign.promotions && campaign.promotions.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Cannot delete campaign with existing promotions.",
      });
    }

    // Refund any reserved funds
    const marketer = await UserModel.findById(campaign.owner).session(session);
    if (marketer && campaign.budget > 0) {
      marketer.wallets.marketer.reserved -= campaign.budget;
      marketer.wallets.marketer.balance += campaign.budget;
      
      marketer.wallets.marketer.transactions.push({
        amount: campaign.budget,
        type: "credit",
        category: "campaign_refund",
        description: `Refund for deleted campaign: "${campaign.title}"`,
        status: "successful",
      });
      
      await marketer.save({ session });
    }

    // Delete associated media file
    if (campaign.mediaUrl) {
      const filePath = path.join(process.cwd(), campaign.mediaUrl.replace(/^\//, ''));
      deleteUploadedFile(filePath);
    }

    // Perform deletion
    await CampaignModel.findByIdAndDelete(id).session(session);
    
    await session.commitTransaction();
    session.endSession();

    // Audit log (you might want to save this to a separate audit collection)
    console.log(`Campaign ${id} deleted by admin ${performedBy}`);

    res.status(200).json({
      success: true,
      message: "Campaign permanently deleted successfully.",
      refundAmount: campaign.budget
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error("Error deleting campaign:", error);
    
    res.status(500).json({
      success: false,
      message: "An error occurred while deleting the campaign.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};