// promotion.controller.js
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import mongoose from "mongoose";
import { validateProofSubmission } from "../../promotion/services/validator.js";
import { isPromotionExpired, isNearingExpiration } from './../services/utils.js';
import { v2 as cloudinary } from "cloudinary";

// ✅ Configure Cloudinary (ensure env variables are set)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * @description Submit promoter proof with media uploaded to Cloudinary.
 * Allows promoters to submit screenshot proof 30min before expiration.
 */
export const submitProof = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { promotionId, viewsCount, notes } = req.body;
    const proofImages = req.files;
    const { promoterId } = req.params;

    // ✅ Validate required fields
    if (!promotionId || !viewsCount || !proofImages || proofImages.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Promotion ID, views count, and proof images are required",
      });
    }

    if (viewsCount < 25) {
      return res.status(400).json({
        success: false,
        message: "Minimum 25 views required for submission",
      });
    }

    // ✅ Validate promotion exists
    const promotion = await PromotionModel.findById(promotionId)
      .populate("campaign")
      .populate("promoter")
      .session(session);

    if (!promotion) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Promotion not found",
      });
    }

    // ✅ Ensure only the correct promoter submits
    if (promotion.promoter._id.toString() !== promoterId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "You are not authorized to submit proof for this promotion",
      });
    }

    if (promotion.status !== "pending") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Cannot submit proof for promotion with status: ${promotion.status}`,
      });
    }

    if (isPromotionExpired(promotion)) {
      return res.status(400).json({
        success: false,
        message: "Cannot submit proof for expired promotion",
      });
    }

    // ✅ Check campaign validity
    const campaign = promotion.campaign;
    if (campaign && campaign.endDate && new Date() > campaign.endDate) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Campaign has ended. Proof submission is closed.",
      });
    }

    if (campaign.status !== "active") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Campaign is ${campaign.status}. Proof submission is closed.`,
      });
    }

    // ✅ Validate minimum views requirement
    const minViews = campaign.minViewsPerPromotion || 25;
    if (parseInt(viewsCount) < minViews) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Minimum ${minViews} views required. You reported ${viewsCount}.`,
      });
    }

  // ✅ Upload all proof images to Cloudinary properly
  const proofMediaUrls = [];
  const proofPublicIds = [];

  for (const image of proofImages) {
    try {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "proofs",
            resource_type: "image",
            public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );

        // Pipe the file buffer into the upload stream
        uploadStream.end(image.buffer);
      });

      proofMediaUrls.push(uploadResult.secure_url);
      proofPublicIds.push(uploadResult.public_id);
    } catch (err) {
      console.error("Cloudinary upload failed:", err);
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({
        success: false,
        message: "Error uploading proof image to Cloudinary",
        error: err.message,
      });
    }
  }


    // ✅ Optional: AI validation of proof images
    let aiValidationResult = null;
    try {
      aiValidationResult = await validateProofSubmission(proofMediaUrls, promotion);
    } catch (validationError) {
      console.warn("AI validation failed, proceeding with manual review:", validationError);
    }

    // ✅ Update promotion with proof data
    promotion.status = "submitted";
    promotion.submittedAt = new Date();
    promotion.proofMedia = proofMediaUrls;
    promotion.proofPublicIds = proofPublicIds; // Store for possible deletion later
    promotion.proofViews = parseInt(viewsCount);
    promotion.notes = notes || "";

    if (aiValidationResult) {
      promotion.aiValidation = {
        isValid: aiValidationResult.isValid,
        confidence: aiValidationResult.confidence,
        feedback: aiValidationResult.feedback,
        validatedAt: new Date(),
      };
    }

    // ✅ Activity logs
    promotion.activityLog.push({
      action: "Proof Submitted",
      details: `Submitted proof with ${viewsCount} views${aiValidationResult ? ` (AI confidence: ${aiValidationResult.confidence}%)` : ""}`,
      timestamp: new Date(),
      performedBy: promoterId,
    });

    campaign.activityLog.push({
      action: "Proof Submitted",
      details: `Promoter ${promotion.promoter.displayName} submitted proof with ${viewsCount} views for promotion UPI: ${promotion.upi}`,
      timestamp: new Date(),
      performedBy: promoterId,
    });

    // ✅ Save both within transaction
    await promotion.save({ session });
    await campaign.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      data: promotion,
      message: aiValidationResult?.isValid
        ? "Proof submitted successfully and AI validation passed"
        : "Proof submitted successfully and awaiting review",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error submitting proof:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
