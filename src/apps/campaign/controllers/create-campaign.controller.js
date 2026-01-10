// apps/campaign/controllers/create-campaign.controller.js

import mongoose from "mongoose";
import { CampaignModel } from "../models/campaign.model.js";
import { UserModel } from "../../user/models/user.model.js";
import { sendEmail } from "../../../services/email.service.js";
import { adminCampaignApprovalTemplate } from "../services/email/adminCampaignApprovalTemplate.js";
import { GenerateVideoThumbnail } from "../services/thumbnail-generator.service.js";

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

      payoutTierId,
      payoutPerPromotion,
      minViewsPerPromotion,
      maxViewsPerPromotion,

      startDate,
      endDate,
      currency = "NGN",
      enableTarget = false,
      campaignType = "standard",
      priority = "medium",
      minRating = 0,
      requirements = [],
      targetLocations = [],
      hasEndDate = true,
      ageTarget = "all",
    } = req.body;

    /* ----------------------------------------
       1️⃣ BASIC VALIDATION
    ----------------------------------------- */
    if (!owner || !title || !budget || !category) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields."
      });
    }

    const numericBudget = Number(budget);
    if (!Number.isFinite(numericBudget) || numericBudget < 1000) {
      return res.status(400).json({
        success: false,
        message: "Minimum campaign budget is ₦1000."
      });
    }

    if (!payoutTierId || !payoutPerPromotion || !minViewsPerPromotion) {
      return res.status(400).json({
        success: false,
        message: "Payout tier selection is required."
      });
    }

    const numericPayout = Number(payoutPerPromotion);
    if (!Number.isFinite(numericPayout) || numericPayout <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payout amount."
      });
    }

    /* ----------------------------------------
       2️⃣ LOAD MARKETER & WALLET CHECK (NEW)
    ----------------------------------------- */
    const marketer = await UserModel.findById(owner)
      .session(session)
      .select("email wallets.marketer.balance");

    if (!marketer) {
      return res.status(404).json({
        success: false,
        message: "Campaign owner not found."
      });
    }

    if (marketer.wallets.marketer.balance < numericBudget) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance to create this campaign."
      });
    }

    /* ----------------------------------------
       3️⃣ MEDIA HANDLING
    ----------------------------------------- */
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Campaign media (image or video) is required."
      });
    }

    let mediaUrl = req.file.path;
    let mediaType = "";
    let thumbnailUrl = "";

    if (req.file.mimetype.startsWith("image/")) {
      mediaType = "image";
      thumbnailUrl = mediaUrl;
    } else if (req.file.mimetype.startsWith("video/")) {
      mediaType = "video";
      thumbnailUrl = await GenerateVideoThumbnail(req.file.filename);
    } else {
      throw new Error("Unsupported media type");
    }

    /* ----------------------------------------
       4️⃣ MAX PROMOTERS & VIEW ESTIMATION
    ----------------------------------------- */
    const maxPromoters = Math.floor(numericBudget / numericPayout);
    if (maxPromoters < 1) {
      return res.status(400).json({
        success: false,
        message: "Budget too low for selected payout tier."
      });
    }

    const estimatedViews = maxPromoters * Number(minViewsPerPromotion);

    /* ----------------------------------------
       5️⃣ CREATE CAMPAIGN (NO FUND MOVEMENT)
    ----------------------------------------- */
    const campaign = new CampaignModel({
      owner,
      title,
      caption,
      link,
      category,
      mediaUrl,
      mediaType,
      thumbnailUrl,

      budget: numericBudget,
      currency,

      maxPromoters,
      currentPromoters: 0,

      payoutModel: "fixed_per_promoter",
      payoutTierId,
      payoutPerPromotion: numericPayout,
      minViewsPerPromotion,
      maxViewsPerPromotion,

      estimatedViews,

      enableTarget,
      ageTarget,
      targetLocations,
      requirements,
      minRating,

      campaignType,
      priority,

      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: hasEndDate && endDate ? new Date(endDate) : null,
      hasEndDate,

      status: "pending", // Admin approval still required
      createdBy: owner,

      activityLog: [{
        action: "Campaign Created",
        details: `Campaign created with budget ₦${numericBudget}`,
        timestamp: new Date(),
        performedBy: owner
      }]
    });

    await campaign.save({ session });

    /* ----------------------------------------
       6️⃣ ADMIN NOTIFICATION
    ----------------------------------------- */
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: "New Campaign Pending Approval",
      html: adminCampaignApprovalTemplate({
        title: campaign.title,
        budget: campaign.budget,
        owner: marketer.email,
        category: campaign.category
      })
    });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Campaign created successfully and pending approval",
      data: campaign.toJSON()
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Create campaign error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create campaign"
    });
  }
};
