// apps/campaign/controllers/create-campaign.controller.js

import mongoose from "mongoose";
import { CampaignModel } from "../models/campaign.model.js";
import { UserModel } from "../../user/models/user.model.js";
import { sendEmail } from "../../../services/email.service.js";
import { adminCampaignApprovalTemplate } from "../services/email/adminCampaignApprovalTemplate.js";
import { buildVideoThumbnailUrl } from "../services/thumbnail-generator.service.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

export const saveCampaign = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const campaign = await session.withTransaction(async () => {
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
        hasEndDate,
        ageTarget = "all",
      } = req.body;

      //console.log('request ',req.body);

      // 1️⃣ VALIDATION
      if (!owner || !title || !budget || !category) {
        const err = new Error("Missing required fields.");
        err.status = 400;
        throw err;
      }

      const numericBudget = Number(budget);
      if (!Number.isFinite(numericBudget) || numericBudget < 1000) {
        const err = new Error("Minimum campaign budget is ₦1000.");
        err.status = 400;
        throw err;
      }

      if (!payoutTierId || !payoutPerPromotion || !minViewsPerPromotion) {
        const err = new Error("Payout tier selection is required.");
        err.status = 400;
        throw err;
      }

      const numericPayout = Number(payoutPerPromotion);
      if (!Number.isFinite(numericPayout) || numericPayout <= 0) {
        const err = new Error("Invalid payout amount.");
        err.status = 400;
        throw err;
      }

      // 2️⃣ LOAD MARKETER + WALLET CHECK
      const marketer = await UserModel.findById(owner)
        .session(session)
        .select("email wallets.marketer.balance");

      if (!marketer) {
        const err = new Error("Campaign owner not found.");
        err.status = 404;
        throw err;
      }

      // if (marketer.wallets.marketer.balance < numericBudget) {
      //   const err = new Error("Insufficient wallet balance to create this campaign.");
      //   err.status = 400;
      //   throw err;
      // }

      // 3️⃣ MEDIA HANDLING
      if (!req.file) {
        const err = new Error("Campaign media (image or video) is required.");
        err.status = 400;
        throw err;
      }

      let mediaUrl = "";
      let mediaType = "";
      let thumbnailUrl = "";

      try {
        const uploadResult = await uploadToCloudinary(req.file.path, `campaigns/${owner}`);
        mediaUrl = uploadResult.secure_url;
        mediaType = uploadResult.resource_type;

        if (mediaType === "video") {
          thumbnailUrl = buildVideoThumbnailUrl(uploadResult.public_id);
        } else {
          thumbnailUrl = mediaUrl;
        }
      } catch (uploadError) {
        console.error("Cloudinary Upload Error:", uploadError);
        const err = new Error("Failed to upload media to cloud storage.");
        err.status = 500;
        throw err;
      }

      // 4️⃣ MAX PROMOTERS & VIEW ESTIMATION
      const maxPromoters = Math.floor(numericBudget / numericPayout);
      if (maxPromoters < 1) {
        const err = new Error("Budget too low for selected payout tier.");
        err.status = 400;
        throw err;
      }

      const estimatedViews = maxPromoters * Number(minViewsPerPromotion);

      const campaignDoc = new CampaignModel({
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
        endDate: endDate ? new Date(endDate) : null,
        hasEndDate: Boolean(endDate),
        status: "draft",
        createdBy: owner,
        activityLog: [{
          action: "Campaign Created as draft",
          details: `Campaign created with budget ₦${numericBudget}`,
          timestamp: new Date(),
          performedBy: owner
        }]
      });

      await campaignDoc.save({ session });
      return campaignDoc;
    });

    // 6️⃣ ADMIN NOTIFICATION (only after transaction commits)
    await sendEmail({
      to: ["schooltraz@gmail.com"],
      subject: "New Campaign Created As Draft",
      html: adminCampaignApprovalTemplate({
        title: campaign.title,
        budget: campaign.budget,
        owner: campaign.owner,
        category: campaign.category
      })
    }).catch(err => console.error("Email send failed:", err));

    return res.status(201).json({
      success: true,
      message: "Campaign created successfully as draft",
      data: campaign
    });
  } catch (error) {
    // Error handling for both validation and transaction failures
    const status = error.status || 400;
    console.error("Create campaign error:", error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to create campaign"
    });
  } finally {
    await session.endSession();
  }
};
