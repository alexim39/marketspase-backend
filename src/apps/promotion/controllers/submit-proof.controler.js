
// promotion.controller.js (patched)
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { CampaignModel } from "../../campaign/models/campaign.model.js";
import mongoose from "mongoose";
import { validateProofSubmission } from "../../promotion/services/validator.js";
import { isPromotionExpired, isNearingExpiration } from './../services/utils.js';
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const submitProof = async (req, res) => {
  const session = await mongoose.startSession();
  await session.startTransaction();
  try {
    const { promotionId, viewsCount, notes } = req.body;
    const proofImages = req.files;
    const { promoterId } = req.params;

    // Basic validations
    if (!promotionId || !viewsCount || !proofImages || proofImages.length === 0) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({
        success: false,
        message: "Promotion ID, views count, and proof images are required",
      });
    }
    if (viewsCount < 25) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: "Minimum 25 views required for submission" });
    }

    // Load promotion + campaign + promoter as LEAN (no hydration -> no casting)
    const promotion = await PromotionModel.findById(promotionId)
      .populate({ path: "campaign", select: "_id title minViewsPerPromotion activityLog status owner", options: { lean: true } })
      .populate({ path: "promoter", select: "_id displayName", options: { lean: true } })
      .lean()
      .session(session);

    if (!promotion) {
      await session.abortTransaction(); session.endSession();
      return res.status(404).json({ success: false, message: "Promotion not found" });
    }
    if (promotion.promoter._id.toString() !== promoterId) {
      await session.abortTransaction(); session.endSession();
      return res.status(403).json({ success: false, message: "You are not authorized to submit proof for this promotion" });
    }
    if (promotion.status !== "pending") {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: `Cannot submit proof for promotion with status: ${promotion.status}` });
    }
    if (isPromotionExpired(promotion)) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: "Cannot submit proof for expired promotion" });
    }

    const campaign = promotion.campaign;
    const minViews = campaign?.minViewsPerPromotion ?? 40;
    if (parseInt(viewsCount, 10) < minViews) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({
        success: false,
        message: `Minimum ${minViews} views required. You reported ${viewsCount}.`,
      });
    }

    // Upload proof images to Cloudinary
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
            (error, result) => (error ? reject(error) : resolve(result))
          );
          uploadStream.end(image.buffer);
        });
        proofMediaUrls.push(uploadResult.secure_url);
        proofPublicIds.push(uploadResult.public_id);
      } catch (err) {
        console.error("Cloudinary upload failed:", err);
        await session.abortTransaction(); session.endSession();
        return res.status(500).json({
          success: false,
          message: "Error uploading proof image to Cloudinary",
          error: err.message,
        });
      }
    }

    // Optional AI validation
    let aiValidationResult = null;
    try {
      aiValidationResult = await validateProofSubmission(proofMediaUrls, promotion);
    } catch (validationError) {
      console.warn("AI validation failed, proceeding with manual review:", validationError);
    }

    // Build promotion update payload (atomic) — we DO NOT hydrate/save docs
    const promotionUpdate = {
      $set: {
        status: "submitted",
        submittedAt: new Date(),
        proofMedia: proofMediaUrls,
        proofPublicIds: proofPublicIds,
        proofViews: parseInt(viewsCount, 10),
        notes: notes ?? "",
        ...(aiValidationResult
          ? { aiValidation: {
              isValid: aiValidationResult.isValid,
              confidence: aiValidationResult.confidence,
              feedback: aiValidationResult.feedback,
              validatedAt: new Date(),
            } }
          : {})
      },
      $push: {
        activityLog: {
          action: "Proof Submitted",
          details: `Submitted proof with ${viewsCount} views${aiValidationResult ? ` (AI confidence: ${aiValidationResult.confidence}%)` : ""}`,
          timestamp: new Date(),
          performedBy: promoterId,
        }
      }
    };

    await PromotionModel.updateOne({ _id: promotionId }, promotionUpdate, { session, runValidators: true });

    // Append campaign activity log atomically — DO NOT hydrate or save Campaign
    await CampaignModel.updateOne(
      { _id: campaign._id },
      {
        $push: {
          activityLog: {
            action: "Proof Submitted",
            details: `Promoter ${promotion.promoter.displayName} submitted proof with ${viewsCount} views for promotion UPI: ${promotion.upi}`,
            timestamp: new Date(),
            performedBy: promoterId,
          }
        }
      },
      { session, runValidators: true }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      data: await PromotionModel.findById(promotionId).lean(), // return lean doc
      message: aiValidationResult?.isValid
        ? "Proof submitted successfully and AI validation passed"
        : "Proof submitted successfully and awaiting review",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error submitting proof:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
