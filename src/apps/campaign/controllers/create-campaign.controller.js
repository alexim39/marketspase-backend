import { CampaignModel } from "../models/campaign.model.js";
import { UserModel } from "../../user/models/user.model.js";
import mongoose from "mongoose";
import { sendEmail } from "../../../services/emailService.js";
import { adminCampaignApprovalTemplate } from '../services/email/adminCampaignApprovalTemplate.js';

/**
 * @description Creates a new campaign with media uploaded to Cloudinary.
 * Checks fund availability and saves the campaign without reserving funds.
 * Funds are reserved per promotion during campaign acceptance.
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
      enableTarget,
      campaignType = "standard",
      priority = "medium",
      minRating = 0,
      requirements = "",
      targetLocations = [],
      hasEndDate = true,
      minViewsPerPromotion = 25
    } = req.body;

    // ✅ Handle uploaded file from Cloudinary
    let mediaUrl = '';
    let mediaType = '';
    let cloudinaryPublicId = '';

    if (req.file) {
      mediaUrl = req.file.path; // Cloudinary URL
      cloudinaryPublicId = req.file.filename; // Cloudinary public ID

      if (req.file.mimetype.startsWith('image/')) {
        mediaType = 'image';
      } else if (req.file.mimetype.startsWith('video/')) {
        mediaType = 'video';
      }
    }

    const payoutPerPromotion = 200;
    const numericBudget = Number(budget);
    const maxPromoters = Math.floor(numericBudget / payoutPerPromotion);

    // ✅ Validate required fields
    if (!owner || !title || !budget || !category) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Missing required fields: owner, title, budget, and category are required.",
        success: false,
      });
    }

    if (!mediaUrl) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Campaign media (image or video) is required.",
        success: false,
      });
    }

    if (numericBudget < 500) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Minimum campaign budget is 500 NGN.",
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

    // ✅ Validate wallet balance
    const marketerWallet = user.wallets.marketer;
    if (marketerWallet.balance < numericBudget) {
      await session.abortTransaction();
      session.endSession();
      return res.status(402).json({
        message: `Insufficient funds. Available: ${marketerWallet.balance} NGN, Required: ${numericBudget} NGN. Please fund your wallet to create this campaign.`,
        success: false,
        availableBalance: marketerWallet.balance,
        requiredAmount: numericBudget
      });
    }

    // ✅ Process requirements
    const requirementsArray = requirements
      ? requirements.split(',').map(req => req.trim()).filter(req => req.length > 0)
      : [];

    // ✅ Process target locations
    const targetLocationsArray = Array.isArray(targetLocations)
      ? targetLocations
      : (typeof targetLocations === 'string'
        ? targetLocations.split(',').map(loc => loc.trim())
        : []);

    // ✅ Create campaign
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
      minViewsPerPromotion: Math.max(25, Number(minViewsPerPromotion)),
      payoutPerPromotion,
      maxPromoters,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : undefined,
      mediaUrl, // Cloudinary URL
      mediaType,
      currency: currency || "NGN",
      status: "pending",
      createdBy: owner,
      availableBudget: numericBudget,
      cloudinaryPublicId, // store for potential deletion later
      activityLog: [{
        action: 'Campaign Created',
        details: `Campaign created with budget: ${numericBudget} NGN. Funds validated but not reserved.`,
        performedBy: owner,
        timestamp: new Date()
      }],
    });

    await newCampaign.save({ session });
    await session.commitTransaction();
    session.endSession();

    // ✅ Log user activity
    try {
      await user.logActivity(
        'campaign_created',
        `Created campaign: "${title}" with budget ${numericBudget} NGN`,
        {
          resourceType: 'campaign',
          resourceId: newCampaign._id,
          metadata: {
            budget: numericBudget,
            maxPromoters,
            payoutPerPromotion,
            availableBudget: numericBudget
          }
        }
      );
    } catch (logError) {
      console.error('Failed to log activity:', logError);
    }

    // ✅ Send success response
    res.status(201).json({
      message: "Campaign created successfully and is awaiting admin approval. Funds will be reserved per promotion when accepted by promoters.",
      success: true,
      campaignId: newCampaign._id,
      mediaUrl,
      mediaType,
      budget: numericBudget,
      maxPromoters,
      payoutPerPromotion,
      availableBudget: numericBudget
    });

    // ✅ Notify admin (after response)
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

      await Promise.all(
        adminEmails.map(email =>
          sendEmail(
            email.trim(),
            `New Campaign Pending Approval: ${newCampaign.title}`,
            emailContent
          )
        )
      );

      console.log(`Admin notification sent for campaign: ${newCampaign._id}`);
    } catch (emailError) {
      console.error('Failed to send admin notification email:', emailError);
    }

  } catch (error) {
    try {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
    } catch (abortError) {
      console.error("Error aborting transaction:", abortError.message);
    } finally {
      session.endSession();
    }

    console.error("Error creating campaign:", error.message);

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
