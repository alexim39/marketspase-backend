import { CampaignModel } from "../models/campaign.model.js";
import { PromotionModel } from "../models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";
import mongoose from "mongoose";
import path from 'path';
import fs from 'fs';
import { validateProofSubmission } from "../services/validator.js";

// Get all promotions for a specific user (promoter)
export const getUserPromotions = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user exists and is a promoter
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role !== 'promoter') {
      return res.status(400).json({
        success: false,
        message: 'Your current user role is not promoter, switch to promoter to continue'
      });
    }

    // Get promotions with populated campaign details
    const promotions = await PromotionModel
      .find({ promoter: userId })
      .populate({
        path: 'campaign',
        select: 'title mediaUrl caption link category mediaType payoutPerPromotion minViewsPerPromotion startDate endDate status'
      })
      .sort({ createdAt: -1 }) // Most recent first
      .lean();

    // Transform the data to match the frontend interface
    const transformedPromotions = promotions.map(promotion => ({
      _id: promotion._id.toString(),
      status: promotion.status,
      payoutAmount: promotion.payoutAmount || promotion.campaign?.payoutPerPromotion,
      submittedAt: promotion.submittedAt,
      validatedAt: promotion.validatedAt,
      paidAt: promotion.paidAt,
      proofMedia: promotion.proofMedia,
      proofViews: promotion.proofViews,
      campaign: {
        _id: promotion.campaign._id.toString(),
        title: promotion.campaign.title,
        mediaUrl: promotion.campaign.mediaUrl,
        caption: promotion.campaign.caption,
        link: promotion.campaign.link,
        category: promotion.campaign.category,
        mediaType: promotion.campaign.mediaType,
        payoutPerPromotion: promotion.campaign.payoutPerPromotion,
        minViewsPerPromotion: promotion.campaign.minViewsPerPromotion,
        startDate: promotion.campaign.startDate,
        endDate: promotion.campaign.endDate,
        status: promotion.campaign.status
      }
    }));

    res.status(200).json({
      success: true,
      data: transformedPromotions,
      message: 'Promotions retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching user promotions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


export const submitProof = async (req, res) => {
  try {
    const { promotionId, viewsCount, notes } = req.body;
    const proofImages = req.files;

    // Validate required fields
    if (!promotionId || !viewsCount || !proofImages || proofImages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Promotion ID, views count, and proof images are required'
      });
    }

    // Validate promotion exists
    const promotion = await PromotionModel.findById(promotionId)
      .populate('campaign')
      .populate('promoter');

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    // Check if promotion is in pending status
    if (promotion.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot submit proof for promotion with status: ${promotion.status}`
      });
    }

    // Check campaign end date
    const campaign = await CampaignModel.findById(promotion.campaign);
    if (campaign && campaign.endDate && new Date() > campaign.endDate) {
      return res.status(400).json({
        success: false,
        message: 'Campaign has ended. Proof submission is closed.'
      });
    }

    // Validate minimum views requirement
    const minViews = campaign?.minViewsPerPromotion || 25;
    if (parseInt(viewsCount) < minViews) {
      return res.status(400).json({
        success: false,
        message: `Minimum ${minViews} views required. You reported ${viewsCount}.`
      });
    }

    // Save proof images locally and build URLs
    const proofMediaUrls = [];
   // const uploadDir = path.join(process.cwd(), 'uploads', 'proofs', promotionId);
     const uploadDir = `/uploads/proofs/${promotionId}`;
    fs.mkdirSync(uploadDir, { recursive: true });

    for (const image of proofImages) {
      const ext = path.extname(image.originalname);
      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, image.buffer);
      // Build a public URL (adjust as needed for your static file serving)
      const publicUrl = `/uploads/proofs/${filename}`;
      proofMediaUrls.push(publicUrl);
    }

    // Optional: AI validation of proof images
    let aiValidationResult = null;
    try {
      aiValidationResult = await validateProofSubmission(proofMediaUrls, promotion);
    } catch (validationError) {
      console.warn('AI validation failed, proceeding with manual review:', validationError);
    }

    // Update promotion with proof data
    const updatedPromotion = await PromotionModel.findByIdAndUpdate(
      promotionId,
      {
        status: aiValidationResult?.isValid ? 'submitted' : 'submitted', // Set to submitted for admin review
        submittedAt: new Date(),
        proofMedia: proofMediaUrls,
        proofViews: parseInt(viewsCount),
        notes: notes || '',
        ...(aiValidationResult && { 
          aiValidation: {
            isValid: aiValidationResult.isValid,
            confidence: aiValidationResult.confidence,
            feedback: aiValidationResult.feedback,
            validatedAt: new Date()
          }
        })
      },
      { new: true, runValidators: true }
    ).populate('campaign promoter');

    // Add to campaign activity log
    if (campaign) {
      campaign.activityLog.push({
        action: 'Proof Submitted',
        details: `Promoter ${promotion.promoter.displayName} submitted proof with ${viewsCount} views`,
        timestamp: new Date()
      });
      await campaign.save();
    }

    res.status(200).json({
      success: true,
      data: updatedPromotion,
      message: 'Proof submitted successfully and awaiting review'
    });

  } catch (error) {
    console.error('Error submitting proof:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


// Optional: Get proof submission details
export const getProofDetails = async (req, res) => {
  try {
    const { promotionId } = req.params;

    const promotion = await PromotionModel.findById(promotionId)
      .populate('campaign')
      .populate('promoter');

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    res.status(200).json({
      success: true,
      data: promotion,
      message: 'Proof details retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching proof details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};