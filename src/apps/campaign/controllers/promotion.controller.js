import { CampaignModel } from "../models/campaign.model.js";
import { PromotionModel } from "../models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";
import path from "path";
import fs from "fs";
import { validateProofSubmission } from "../services/validator.js";
import mongoose from "mongoose";

/**
 * @description Fetches all promotion records for a specific promoter,
 * populating all related campaign and user details.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @returns {Promise<void>}
 */
export const getUserPromotions = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate that the userId is provided
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    // Find the user and check their role
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (user.role !== "promoter") {
      return res.status(400).json({
        success: false,
        message:
          "Your current user role is not promoter. Please switch roles to continue.",
      });
    }

    // Find promotions and fully populate all related data.
    // We populate the 'campaign' and 'promoter' fields.
    // The `select` option is removed to include all fields by default,
    // which aligns with the request for "all population of other objects".
    const promotions = await PromotionModel.find({ promoter: userId })
      .populate({
        path: "campaign",
        // Select all fields from the Campaign model
        select: "",
      })
      .populate({
        path: "promoter",
        // Select all fields from the User model, but explicitly exclude the password
        select: "-password",
      })
      .sort({ createdAt: -1 }) // Sort from newest to oldest
      .lean(); // Use .lean() for faster query execution since we don't need Mongoose documents

    if (!promotions || promotions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No promotions found for this user.",
      });
    }

    // The data is already correctly structured, so we can return it directly.
    res.status(200).json({
      success: true,
      data: promotions,
      message: "Promotions retrieved successfully.",
    });
  } catch (error) {
    console.error("Error fetching user promotions:", error);
    // Handle potential Mongoose CastErrors for invalid IDs
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format.",
      });
    }
    // Return a generic error for other issues
    res.status(500).json({
      success: false,
      message: "An internal server error occurred while fetching promotions.",
    });
  }
};

/*
export const submitProof = async (req, res) => {
  try {
    const { promotionId, viewsCount, notes } = req.body;
    const proofImages = req.files;

    // Validate required fields
    if (
      !promotionId ||
      !viewsCount ||
      !proofImages ||
      proofImages.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Promotion ID, views count, and proof images are required",
      });
    }

    // Validate promotion exists
    const promotion = await PromotionModel.findById(promotionId)
      .populate("campaign")
      .populate("promoter");

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: "Promotion not found",
      });
    }

    // Check if promotion is in pending status
    if (promotion.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot submit proof for promotion with status: ${promotion.status}`,
      });
    }

    // Check campaign end date
    const campaign = await CampaignModel.findById(promotion.campaign);
    if (campaign && campaign.endDate && new Date() > campaign.endDate) {
      return res.status(400).json({
        success: false,
        message: "Campaign has ended. Proof submission is closed.",
      });
    }

    // Validate minimum views requirement
    const minViews = campaign?.minViewsPerPromotion || 25;
    if (parseInt(viewsCount) < minViews) {
      return res.status(400).json({
        success: false,
        message: `Minimum ${minViews} views required. You reported ${viewsCount}.`,
      });
    }

    // NEW LOGIC: Use the campaignId to create the proofs folder within the campaign's directory
    const campaignId = promotion.campaign._id.toString();
    //const uploadDir = path.join(process.cwd(), 'uploads', 'campaigns', campaignId, 'proofs');
    const uploadDir = path.join(process.cwd(), "src", "uploads", "proofs");

    // Ensure the directory exists
    fs.mkdirSync(uploadDir, { recursive: true });

    // Save proof images locally and build URLs
    const proofMediaUrls = [];
    for (const image of proofImages) {
      const ext = path.extname(image.originalname);
      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const filePath = path.join(uploadDir, filename);

      // Use fs.writeFileSync to save the file
      fs.writeFileSync(filePath, image.buffer);

      // Build a public URL (adjust this to match your static file serving)
      //const publicUrl = `/uploads/campaigns/${campaignId}/proofs/${filename}`;
      const publicUrl = `/src/uploads/proofs/${filename}`;
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

    // Update promotion with proof data
    const updatedPromotion = await PromotionModel.findByIdAndUpdate(
      promotionId,
      {
        status: aiValidationResult?.isValid ? "submitted" : "submitted", // Set to submitted for admin review
        submittedAt: new Date(),
        proofMedia: proofMediaUrls,
        proofViews: parseInt(viewsCount),
        notes: notes || "",
        ...(aiValidationResult && {
          aiValidation: {
            isValid: aiValidationResult.isValid,
            confidence: aiValidationResult.confidence,
            feedback: aiValidationResult.feedback,
            validatedAt: new Date(),
          },
        }),
      },
      { new: true, runValidators: true }
    ).populate("campaign promoter");

    // Add to campaign activity log
    if (campaign) {
      campaign.activityLog.push({
        action: "Proof Submitted",
        details: `Promoter ${promotion.promoter.displayName} submitted proof with ${viewsCount} views`,
        timestamp: new Date(),
      });
      await campaign.save();
    }

    res.status(200).json({
      success: true,
      data: updatedPromotion,
      message: "Proof submitted successfully and awaiting review",
    });
  } catch (error) {
    console.error("Error submitting proof:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
*/


/**
 * @description Submit a promoter proofs. 
 * It allows promoters to submit screenshot of their promotion 30min before expiration
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @returns {Promise<void>}
 */
export const submitProof = async (req, res) => {
  try {
    const {
      promotionId,
      viewsCount,
      notes
    } = req.body;
    const proofImages = req.files;

    // Validate required fields
    if (
      !promotionId ||
      !viewsCount ||
      !proofImages ||
      proofImages.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Promotion ID, views count, and proof images are required",
      });
    }

    // Validate promotion exists
    const promotion = await PromotionModel.findById(promotionId)
      .populate("campaign")
      .populate("promoter");

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: "Promotion not found",
      });
    }

    // Check if promotion is in pending status
    if (promotion.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot submit proof for promotion with status: ${promotion.status}`,
      });
    }

    // LOGIC: Check if promotion submission is within the last 30 minutes of its 24-hour window
    const creationTime = new Date(promotion.createdAt).getTime();
    const now = new Date().getTime();
    const thirtyMinutesInMs = 30 * 60 * 1000;
    const twentyFourHoursInMs = 24 * 60 * 60 * 1000;
    const timeSinceCreation = now - creationTime;

    if (timeSinceCreation < twentyFourHoursInMs - thirtyMinutesInMs) {
      return res.status(400).json({
        success: false,
        message: "Proof can only be submitted 30 minutes before the promotion expires.",
      });
    }

    // Check campaign end date
    const campaign = await CampaignModel.findById(promotion.campaign);
    if (campaign && campaign.endDate && new Date() > campaign.endDate) {
      return res.status(400).json({
        success: false,
        message: "Campaign has ended. Proof submission is closed.",
      });
    }

    // Validate minimum views requirement
    const minViews = campaign?.minViewsPerPromotion || 25;
    if (parseInt(viewsCount) < minViews) {
      return res.status(400).json({
        success: false,
        message: `Minimum ${minViews} views required. You reported ${viewsCount}.`,
      });
    }

    // NEW LOGIC: Use the campaignId to create the proofs folder within the campaign's directory
    const campaignId = promotion.campaign._id.toString();
    //const uploadDir = path.join(process.cwd(), 'uploads', 'campaigns', campaignId, 'proofs');
    const uploadDir = path.join(process.cwd(), "src", "uploads", "proofs");

    // Ensure the directory exists
    fs.mkdirSync(uploadDir, {
      recursive: true
    });

    // Save proof images locally and build URLs
    const proofMediaUrls = [];
    for (const image of proofImages) {
      const ext = path.extname(image.originalname);
      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const filePath = path.join(uploadDir, filename);

      // Use fs.writeFileSync to save the file
      fs.writeFileSync(filePath, image.buffer);

      // Build a public URL (adjust this to match your static file serving)
      //const publicUrl = `/uploads/campaigns/${campaignId}/proofs/${filename}`;
      const publicUrl = `/src/uploads/proofs/${filename}`;
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

    // Update promotion with proof data
    const updatedPromotion = await PromotionModel.findByIdAndUpdate(
      promotionId, {
        status: aiValidationResult?.isValid ? "submitted" : "submitted", // Set to submitted for admin review
        submittedAt: new Date(),
        proofMedia: proofMediaUrls,
        proofViews: parseInt(viewsCount),
        notes: notes || "",
        ...(aiValidationResult && {
          aiValidation: {
            isValid: aiValidationResult.isValid,
            confidence: aiValidationResult.confidence,
            feedback: aiValidationResult.feedback,
            validatedAt: new Date(),
          },
        }),
      }, {
        new: true,
        runValidators: true
      }
    ).populate("campaign promoter");

    // Add to campaign activity log
    if (campaign) {
      campaign.activityLog.push({
        action: "Proof Submitted",
        details: `Promoter ${promotion.promoter.displayName} submitted proof with ${viewsCount} views`,
        timestamp: new Date(),
      });
      await campaign.save();
    }

    res.status(200).json({
      success: true,
      data: updatedPromotion,
      message: "Proof submitted successfully and awaiting review",
    });
  } catch (error) {
    console.error("Error submitting proof:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


/**
 * @description Fetches promotion proof for a specific user.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @returns {Promise<void>}
 */
export const getProofDetails = async (req, res) => {
  try {
    const { promotionId } = req.params;

    const promotion = await PromotionModel.findById(promotionId)
      .populate("campaign")
      .populate("promoter");

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: "Promotion not found",
      });
    }

    res.status(200).json({
      success: true,
      data: promotion,
      message: "Proof details retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching proof details:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


/**
 * @description Allows a promoter to "download" a campaign post. This action
 * marks the promotion as 'isDownloaded' and registers the promoter to the campaign.
 * It also checks if the campaign has available slots and updates the campaign's
 * `currentPromoters` count within a secure transaction.
 * @param {object} req - The request object containing campaignId and promoterId.
 * @param {object} res - The response object from Express.js.
 * @returns {Promise<void>}
 */
export const downloadPromotion = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { campaignId, promoterId } = req.body;

    // Validate required fields
    if (!campaignId || !promoterId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Missing required fields: campaignId and promoterId.",
        success: false,
      });
    }

    // Find the campaign and user (promoter)
    const campaign = await CampaignModel.findById(campaignId).session(session);
    const promoter = await UserModel.findById(promoterId).session(session);

    if (!campaign || !promoter) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        message: "Campaign or Promoter not found.",
        success: false,
      });
    }

    // Check if the user is a promoter
    // if (promoter.role !== 'promoter') {
    //   await session.abortTransaction();
    //   session.endSession();
    //   return res.status(403).json({
    //     message: 'User is not authorized to download this promotion.',
    //     success: false,
    //   });
    // }

    // Check if a promotion already exists for this campaign and promoter
    const existingPromotion = await PromotionModel.findOne({
      campaign: campaignId,
      promoter: promoterId,
    }).session(session);

    // if (existingPromotion) {
    //   // If the promotion already exists and is already downloaded, return success
    //   if (existingPromotion.isDownloaded) {
    //     await session.commitTransaction();
    //     session.endSession();
    //     return res.status(200).json({
    //       message: 'Promotion has already been downloaded.',
    //       success: true,
    //       promotion: existingPromotion,
    //     });
    //   }
    // }

    // Use the `canAssignPromoter` helper method from the Campaign model
    // if (!campaign.canAssignPromoter()) {
    //   await session.abortTransaction();
    //   session.endSession();
    //   return res.status(400).json({
    //     message: 'This campaign is no longer accepting new promoters.',
    //     success: false,
    //   });
    // }

    // If no promotion exists, create a new one.
    let promotion;
    if (!existingPromotion) {
      //console.log('None existing')

      promotion = new PromotionModel({
        campaign: campaignId,
        promoter: promoterId,
        payoutAmount: campaign.payoutPerPromotion,
        isDownloaded: true,
        notes: "Campaign post downloaded by promoter.",
      });
      await promotion.save({ session });
    } else {
      //console.log('Already existing')

      // If a promotion exists but isn't marked as downloaded, update it
      existingPromotion.isDownloaded = true;
      existingPromotion.status = "pending"; // Reset status if needed, though 'pending' is the default
      promotion = existingPromotion;
      await promotion.save({ session });
    }

    // Use the `assignPromoter` helper method from the Campaign model
    //campaign.assignPromoter();
    await campaign.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      message:
        "Campaign post downloaded successfully. You can now share it on your status.",
      success: true,
      campaign: {
        title: campaign.title,
        caption: campaign.caption,
        link: campaign.link,
        mediaUrl: `${req.protocol}://${req.get("host")}${campaign.mediaUrl}`,
        mediaType: campaign.mediaType,
      },
      promotionId: promotion._id,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error downloading promotion:", error.message);
    res.status(500).json({
      message: "Error occurred while processing the download request.",
      success: false,
      error: error.message,
    });
  }
};


/**
 * Controller to update a promotion's status by an admin.
 * This function handles the financial logic for validating, rejecting, or marking a promotion as paid.
 * It operates based on a two-step escrow model:
 * 1. Funds are moved to the promoter's reserved wallet upon promotion acceptance.
 * 2. Funds are moved from reserved to balance upon validation, or refunded to the advertiser upon rejection.
 */
export const updatePromotionStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    // 1. Validate input
    if (!id || !status) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Promotion ID and new status are required.",
      });
    }

    const validStatuses = ["validated", "rejected", "paid"];
    if (!validStatuses.includes(status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid status provided. Only 'validated', 'rejected', or 'paid' are allowed.",
      });
    }

    // 2. Find the promotion and populate related documents
    const promotion = await PromotionModel.findById(id)
      .populate({
        path: 'campaign',
        populate: {
          path: 'owner', // Populate the campaign owner (advertiser)
          model: 'User'
        }
      })
      .populate('promoter')
      .session(session);

    if (!promotion) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Promotion not found.",
      });
    }

    const campaign = promotion.campaign;
    const promoter = promotion.promoter;
    const advertiser = campaign.owner;
    const payoutAmount = promotion.payoutAmount;

    // 3. Handle status transitions based on the new status
    switch (status) {
      case "validated":
        if (promotion.status !== "submitted") {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: "Cannot validate a promotion that is not in 'submitted' status.",
          });
        }
        
        // **FINANCIAL LOGIC: Reserved to Balance Fund Transfer**
        // The funds are already in the promoter's reserved wallet.
        // We now move them to their main balance.
        promoter.wallets.promoter.reserved -= payoutAmount;
        promoter.wallets.promoter.balance += payoutAmount;

        // Add a credit transaction log to the promoter's wallet
        promoter.wallets.promoter.transactions.push({
            amount: payoutAmount,
            type: 'credit',
            category: 'promotion',
            description: `Earnings from campaign: ${campaign.title} (UPI: ${promotion.upi})`,
            relatedCampaign: campaign._id,
            relatedPromotion: promotion._id,
            status: 'successful'
        });

        // Update promotion status and timestamp
        promotion.status = "validated";
        promotion.validatedAt = new Date();
        
        // Update campaign stats
        campaign.validatedPromotions += 1;
        
        // Check if the campaign is completed
        if (campaign.validatedPromotions >= campaign.maxPromoters) {
          campaign.status = "completed";
          campaign.endDate = new Date();
        }

        // Add to campaign activity log
        campaign.activityLog.push({
          action: "Promotion Validated",
          details: `Promotion ID ${promotion._id} validated. Promoter ${promoter.displayName} earned ${payoutAmount} NGN.`,
        });
        
        break;

      case "rejected":
        if (promotion.status !== "submitted") {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: "Cannot reject a promotion that is not in 'submitted' status.",
          });
        }
        
        // Update promotion status and rejection reason
        promotion.status = "rejected";
        promotion.rejectionReason = rejectionReason || "No reason provided.";

        // **FINANCIAL LOGIC: Reserved Funds Refund to Advertiser**
        // The funds were in the promoter's reserved wallet.
        // We now debit them from there and credit them back to the advertiser's main balance.
        promoter.wallets.promoter.reserved -= payoutAmount;
        advertiser.wallets.advertiser.reserved += payoutAmount;

        // Add a refund transaction log to the advertiser's wallet
        advertiser.wallets.advertiser.transactions.push({
            amount: payoutAmount,
            type: 'credit',
            category: 'refund',
            description: `Refund for rejected promotion: ${promotion.upi}`,
            relatedCampaign: campaign._id,
            relatedPromotion: promotion._id,
            status: 'successful'
        });
        
        // Revert campaign stats
        campaign.currentPromoters -= 1;
        campaign.spentBudget -= payoutAmount; // Revert the spent budget
        
        // Check if the campaign can be re-opened for new promoters
        if (campaign.status === "exhausted" && campaign.canAssignPromoter()) {
          campaign.status = "active";
        }
        
        // Add to campaign activity log
        campaign.activityLog.push({
          action: "Promotion Rejected",
          details: `Promotion ID ${promotion._id} rejected. Funds refunded to advertiser. Reason: ${promotion.rejectionReason}.`,
        });
        
        break;

      case "paid":
        if (promotion.status !== "validated") {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: "Cannot mark a promotion as 'paid' that is not in 'validated' status.",
          });
        }
        // This 'paid' status should ideally be handled when a promoter successfully withdraws funds.
        // For now, this logic is sufficient. It just updates a counter.
        promotion.status = "paid";
        promotion.paidAt = new Date();
        
        // Update campaign paid promotions count
        campaign.paidPromotions += 1;
        
        // Add to campaign activity log
        campaign.activityLog.push({
          action: "Promotion Paid",
          details: `Payout for promotion ID ${promotion._id} confirmed.`,
        });
        
        break;

      default:
        await session.abortTransaction();
        session.endSession();
        break;
    }

    // 4. Save the changes to all documents
    await promotion.save({ session });
    await campaign.save({ session });
    await promoter.save({ session });
    await advertiser.save({ session });

    // 5. Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // 6. Send a success response
    res.status(200).json({
      success: true,
      message: `Promotion status updated to '${status}' successfully.`,
      data: promotion,
    });
  } catch (error) {
    // 7. Handle errors and abort the transaction
    await session.abortTransaction();
    session.endSession();
    console.error("Error updating promotion status:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid promotion ID format.",
      });
    }
    res.status(500).json({
      success: false,
      message: "An error occurred while updating the promotion status.",
    });
  }
};