// promotion.controller.js
import { CampaignModel } from "../../campaign/models/campaign.model.js";
import { PromotionModel } from "../../campaign/models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";;
import mongoose from "mongoose";
import { validateProofSubmission } from "../../promotion/services/validator.js";
import path from "path";
import fs from "fs";
import {isPromotionExpired, isNearingExpiration} from './../services/utils.js'



/**
 * @description Submit a promoter proofs. 
 * It allows promoters to submit screenshot of their promotion 30min before expiration
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @returns {Promise<void>}
 */
export const submitProof = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      promotionId,
      viewsCount,
      notes
    } = req.body;
    const proofImages = req.files;
    const {promoterId} = req.params; 

    // Validate required fields
    if (
      !promotionId ||
      !viewsCount ||
      !proofImages ||
      proofImages.length === 0
    ) {
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
        message: 'Minimum 25 views required for submission'
      });
    }

    // Validate promotion exists within transaction
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

    // Verify the authenticated user owns this promotion
    if (promotion.promoter._id.toString() !== promoterId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "You are not authorized to submit proof for this promotion",
      });
    }

    // Check if promotion is in pending status
    if (promotion.status !== "pending") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Cannot submit proof for promotion with status: ${promotion.status}`,
      });
    }

      // Check if promotion is expired
    if (isPromotionExpired(promotion)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot submit proof for expired promotion'
      });
    }

     // Check if it's too early to submit (30 minutes before expiration)
    if (!isNearingExpiration(promotion)) {
      return res.status(400).json({
        success: false,
        message: 'Proof submission is only allowed within 30 minutes of expiration'
      });
    }


    // Check campaign end date and status
    const campaign = promotion.campaign;
    if (campaign && campaign.endDate && new Date() > campaign.endDate) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Campaign has ended. Proof submission is closed.",
      });
    }

    if (campaign.status !== 'active') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Campaign is ${campaign.status}. Proof submission is closed.`,
      });
    }

    // Validate minimum views requirement
    const minViews = campaign.minViewsPerPromotion || 25;
    if (parseInt(viewsCount) < minViews) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Minimum ${minViews} views required. You reported ${viewsCount}.`,
      });
    }

    // Create proofs directory
    //const uploadDir = path.join(process.cwd(), "uploads", "proofs", promotionId);
    const uploadDir = path.join(process.cwd(), "src", "uploads", "proofs");
    fs.mkdirSync(uploadDir, { recursive: true });

    // Save proof images locally and build URLs
    const proofMediaUrls = [];
    for (const image of proofImages) {
      const ext = path.extname(image.originalname);
      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const filePath = path.join(uploadDir, filename);

      fs.writeFileSync(filePath, image.buffer);
      //const publicUrl = `/uploads/proofs/${promotionId}/${filename}`;
      const publicUrl = `/uploads/proofs/${filename}`;
      proofMediaUrls.push(publicUrl);
    }

    // Optional: AI validation of proof images
    let aiValidationResult = null;
    try {
      aiValidationResult = await validateProofSubmission(
        proofMediaUrls,
        promotion
      );
    } catch (validationError) {
      console.warn(
        "AI validation failed, proceeding with manual review:",
        validationError
      );
    }

    // Update promotion with proof data using model methods
    promotion.status = "submitted";
    promotion.submittedAt = new Date();
    promotion.proofMedia = proofMediaUrls;
    promotion.proofViews = parseInt(viewsCount);
    promotion.notes = notes || "";
    
    // Add AI validation results if available
    if (aiValidationResult) {
      promotion.aiValidation = {
        isValid: aiValidationResult.isValid,
        confidence: aiValidationResult.confidence,
        feedback: aiValidationResult.feedback,
        validatedAt: new Date(),
      };
    }
    
    // Add to promotion activity log
    promotion.activityLog.push({
      action: "Proof Submitted",
      details: `Submitted proof with ${viewsCount} views${aiValidationResult ? ` (AI confidence: ${aiValidationResult.confidence}%)` : ''}`,
      timestamp: new Date(),
      performedBy: promoterId
    });

    // Add to campaign activity log
    campaign.activityLog.push({
      action: "Proof Submitted",
      details: `Promoter ${promotion.promoter.displayName} submitted proof with ${viewsCount} views for promotion UPI: ${promotion.upi}`,
      timestamp: new Date(),
      performedBy: promoterId
    });

    // Save all documents within transaction
    await promotion.save({ session });
    await campaign.save({ session });

    // Commit transaction
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
    // Rollback transaction on error
    await session.abortTransaction();
    session.endSession();
    
    console.error("Error submitting proof:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
