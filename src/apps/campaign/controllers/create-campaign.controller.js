import { CampaignModel } from "../models/campaign.model.js";
import { UserModel } from "../../user/models/user.model.js";
import mongoose from "mongoose";
import fs from "fs";
import { sendEmail } from "../../../services/emailService.js";
import { adminCampaignApprovalTemplate } from '../services/email/adminCampaignApprovalTemplate.js';

/**
 * @description Creates a new campaign. This function handles the validation,
 * checks fund availability, and saves the campaign without reserving funds.
 * Funds will be reserved per promotion during campaign acceptance.
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

    // Validate budget amount
    if (budget < 500) {
      deleteUploadedFile(req.file?.path);
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Minimum campaign budget is 500 NGN.",
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

    // ✅ ONLY VALIDATE FUNDS, DON'T RESERVE THEM
    const marketerWallet = user.wallets.marketer;
    const numericBudget = Number(budget);
    
    if (marketerWallet.balance < numericBudget) {
      deleteUploadedFile(req.file?.path);
      await session.abortTransaction();
      session.endSession();
      return res.status(402).json({
        message: `Insufficient funds. Available: ${marketerWallet.balance} NGN, Required: ${numericBudget} NGN. Please fund your wallet to create this campaign.`,
        success: false,
        availableBalance: marketerWallet.balance,
        requiredAmount: numericBudget
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

    // Create campaign with available budget tracking
    const newCampaign = new CampaignModel({
      owner,
      title: title.trim(),
      caption: caption ? caption.trim() : "",
      link: link ? link.trim() : "",
      category: category.trim(),
      budget: numericBudget,
      enableTarget: Boolean(enableTarget),
      targetLocations: targetLocationsArray,
      requirements: requirementsArray,
      minRating: Number(minRating),
      campaignType,
      priority,
      hasEndDate: Boolean(hasEndDate),
      minViewsPerPromotion: Math.max(25, Number(minViewsPerPromotion)), // Ensure minimum 25 views
      payoutPerPromotion,
      maxPromoters,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : undefined,
      mediaUrl,
      mediaType,
      currency: currency || "NGN",
      status: "pending",
      createdBy: owner,
      // Track available budget for promotions (initially equals total budget)
      availableBudget: numericBudget,
      activityLog: [{ 
        action: 'Campaign Created', 
        details: `Campaign created with budget: ${numericBudget} NGN. Funds validated but not reserved.`,
        performedBy: owner,
        timestamp: new Date()
      }],
    });

    // ✅ NO FUNDS RESERVED HERE - Only validation done above
    await newCampaign.save({ session });

    await session.commitTransaction();
    session.endSession();

    // User activity log (outside transaction for performance)
    try {
      await user.logActivity('campaign_created', `Created campaign: "${title}" with budget ${numericBudget} NGN`, {
        resourceType: 'campaign',
        resourceId: newCampaign._id,
        metadata: { 
          budget: numericBudget, 
          maxPromoters, 
          payoutPerPromotion,
          availableBudget: numericBudget
        }
      });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
      // Don't fail the main request due to log error
    }

    // Send success response
    res.status(201).json({
      message: "Campaign created successfully and is awaiting admin approval. Funds will be reserved per promotion when accepted by promoters.",
      success: true,
      campaignId: newCampaign._id,
      mediaUrl: mediaUrl ? `${req.protocol}://${req.get('host')}${mediaUrl}` : null,
      mediaType: mediaType,
      budget: numericBudget,
      maxPromoters,
      payoutPerPromotion,
      availableBudget: numericBudget
    });

    // Notify admins of new campaign for approval (AFTER sending response)
    try {
      const marketer = await UserModel.findById(owner);
      const adminEmails = ['schooltraz@gmail.com'];
      
      const emailContent = adminCampaignApprovalTemplate({
        title: newCampaign.title,
        campaignId: newCampaign._id,
        marketerName: marketer?.displayName || 'Unknown Marketer',
        budget: newCampaign.budget,
        category: newCampaign.category,
        maxPromoters: newCampaign.maxPromoters,
        payoutPerPromotion: newCampaign.payoutPerPromotion,
        mediaType: newCampaign.mediaType,
        caption: newCampaign.caption,
        requirements: newCampaign.requirements,
        targetLocations: newCampaign.targetLocations,
        availableBudget: newCampaign.availableBudget
      });
      
      // Send to all admin emails
      await Promise.all(
        adminEmails.map(email => 
          sendEmail({
            to: email.trim(),
            subject: `New Campaign Pending Approval: ${newCampaign.title}`,
            html: emailContent
          })
        )
      );
      
      console.log(`Admin notification sent for campaign: ${newCampaign._id}`);
    } catch (emailError) {
      console.error('Failed to send admin notification email:', emailError);
      // Don't fail the main request if email fails
    }

  } catch (error) {
    // Safe transaction cleanup
    try {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
    } catch (abortError) {
      console.error("Error aborting transaction:", abortError.message);
    } finally {
      session.endSession();
    }
    
    // Clean up the uploaded file on error
    deleteUploadedFile(req.file?.path);

    console.error("Error creating campaign:", error.message);

    // Enhanced error handling
    let userMessage = "Error occurred while creating campaign.";
    let statusCode = 500;

    if (error.name === 'ValidationError') {
      userMessage = "Data validation failed. Please check the provided information.";
      statusCode = 400;
    } else if (error.name === 'CastError') {
      userMessage = "Invalid data format provided.";
      statusCode = 400;
    } else if (error.code === 'EAI_AGAIN') {
      userMessage = "Database connection error. Please try again later.";
      statusCode = 503;
    }

    res.status(statusCode).json({
      message: userMessage,
      success: false,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};