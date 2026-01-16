 // apps/campaign/controllers/create-campaign.controller.js

import mongoose from "mongoose";
import { CampaignModel } from "../models/campaign.model.js";
import { UserModel } from "../../user/models/user.model.js";
import { sendEmail } from "../../../services/email.service.js";
import { adminCampaignApprovalTemplate } from "../services/email/adminCampaignApprovalTemplate.js";
import { GenerateVideoThumbnail, buildVideoThumbnailUrl } from "../services/thumbnail-generator.service.js";

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

     //  1️⃣ BASIC VALIDATION
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

     //  2️⃣ LOAD MARKETER & WALLET CHECK (NEW)
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

     //  3️⃣ MEDIA HANDLING
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

      // Try to use Multer-Cloudinary's .filename as the public_id first
      let publicId = req.file.filename;

      // Fallback: extract public_id from a Cloudinary URL if path is a secure_url
      if ((!publicId || typeof publicId !== "string") && typeof req.file.path === "string" && req.file.path.includes("res.cloudinary.com")) {
        try {
          const url = new URL(req.file.path);
          // /<cloud>/<resource_type>/upload/v<ver>/<folder>/<id>.<ext>
          const parts = url.pathname.split("/").filter(Boolean);
          const uploadIdx = parts.findIndex(p => p === "upload");
          // if a version segment (starting with 'v') exists, skip it
          const afterUpload = parts.slice(uploadIdx + 1);
          const versionIdx = afterUpload[0]?.startsWith("v") ? 1 : 0;
          const publicPath = afterUpload.slice(versionIdx + 0).join("/");
          publicId = publicPath.replace(/\.[^/.]+$/, "");
        } catch (_) { /* ignore; we'll use a placeholder below */ }
      }

      // Build the thumbnail URL without blocking
      thumbnailUrl = publicId
        ? buildVideoThumbnailUrl(publicId)
        : "/static/placeholders/video-thumb.png";
    } else {
      throw new Error("Unsupported media type");
    }

      // 4️⃣ MAX PROMOTERS & VIEW ESTIMATION
    const maxPromoters = Math.floor(numericBudget / numericPayout);
    if (maxPromoters < 1) {
      return res.status(400).json({
        success: false,
        message: "Budget too low for selected payout tier."
      });
    }

    const estimatedViews = maxPromoters * Number(minViewsPerPromotion);

     //  5️⃣ CREATE CAMPAIGN (NO FUND MOVEMENT)
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

    

    await session.commitTransaction();
    session.endSession();

    //  6️⃣ ADMIN NOTIFICATION
    await sendEmail({
      to: ['schooltraz@gmail.com'],
      // to: process.env.ADMIN_EMAIL,
      subject: "New Campaign Pending Approval",
      html: adminCampaignApprovalTemplate({
        title: campaign.title,
        budget: campaign.budget,
        owner: marketer.email,
        category: campaign.category
      })
    }).catch(err => console.error("Email send failed:", err));

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
