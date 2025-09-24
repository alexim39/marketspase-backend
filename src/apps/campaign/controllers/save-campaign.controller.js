import { CampaignModel } from "../models/campaign.model.js";
import { UserModel } from "../../user/models/user.model.js";
import mongoose from "mongoose";
import fs from "fs";


/**
 * @description Creates a new campaign. This function handles the validation,
 * reserves the campaign budget from the user's wallet, and securely saves
 * the new campaign to the database using a transaction.
 * @param {object} req - The request object from Express.js.
 * @param {object} res - The response object from Express.js.
 * @returns {Promise<void>}
 */
export const saveCampaign = async (req, res) => {
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

    // const marketerWallet = user.wallets.marketer;
    // if (marketerWallet.balance < budget) {
    //   deleteUploadedFile(req.file?.path);
    //   await session.abortTransaction();
    //   session.endSession();
    //   return res.status(402).json({
    //     message: "Insufficient funds. Please fund your wallet to create this campaign.",
    //     success: false,
    //   });
    // }

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
      status: "draft",
      createdBy: owner,
      activityLog: [{ 
        action: 'Campaign Saved to Draft', 
        details: 'Initial campaign saved to draft.',
        performedBy: owner
      }],
    });

    // Reserve budget from marketer wallet
    // marketerWallet.balance = Number(marketerWallet.balance) - Number(budget);
    // marketerWallet.reserved = Number(marketerWallet.reserved) + Number(budget);
    // marketerWallet.transactions.push({
    //   amount: budget,
    //   type: "debit",
    //   category: "campaign",
    //   description: `Funds reserved for campaign: "${title}"`,
    //   relatedCampaign: newCampaign._id,
    //   status: "reserved",
    // });

    await newCampaign.save({ session });
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "Campaign saved successfully to draft.",
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