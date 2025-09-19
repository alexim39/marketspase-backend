import { CampaignModel } from "../models/campaign.model.js";
import { PromotionModel } from "../models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";


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
 * Controller to update a promotion's status by an admin.
 * This function handles the financial logic for validating, rejecting, or marking a promotion as paid.
 * It operates based on a two-step escrow model:
 * 1. Funds are moved to the promoter's reserved wallet upon promotion acceptance.
 * 2. Funds are moved from reserved to balance upon validation, or refunded to the marketer upon rejection.
 */
export const updatePromotionStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    const {performedBy} = req.params; // Get the user performing the action

    // 1. Validate input
    if (!id || !status) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Promotion ID and new status are required.",
      });
    }

    if (!performedBy) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        success: false,
        message: "Authentication required to perform this action.",
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
          path: 'owner', // Populate the campaign owner (marketer)
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
    const marketer = campaign.owner;
    const payoutAmount = promotion.payoutAmount || campaign.payoutPerPromotion;

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
        
        // Use the model method for consistency
        promotion.validatePromotion(performedBy);
        
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

        // Update campaign stats using model method
        campaign.validatePromotion();
        
        // Check if the campaign is completed
        if (campaign.validatedPromotions >= campaign.maxPromoters) {
          campaign.updateStatus("completed", performedBy, "All promotions validated");
          campaign.endDate = new Date();
        }

        // Add to campaign activity log with performedBy
        campaign.activityLog.push({
          action: "Promotion Validated",
          details: `Promotion UPI ${promotion.upi} validated. Promoter ${promoter.displayName} earned ${payoutAmount} NGN.`,
          performedBy: performedBy,
          timestamp: new Date()
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
        
        // Use the model method for consistency
        promotion.rejectPromotion(rejectionReason || "No reason provided.", performedBy);

        // **FINANCIAL LOGIC: Reserved Funds Refund to marketer**
        // The funds were in the promoter's reserved wallet.
        // We now debit them from there and credit them back to the marketer's reserved balance.
        promoter.wallets.promoter.reserved -= payoutAmount;
        marketer.wallets.marketer.reserved += payoutAmount;

        // Add a refund transaction log to the marketer's wallet
        marketer.wallets.marketer.transactions.push({
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
        campaign.totalPromotions -= 1;
        campaign.spentBudget -= payoutAmount; // Revert the spent budget
        
        // Check if the campaign can be re-opened for new promoters
        if (campaign.status === "exhausted" && campaign.canAssignPromoter()) {
          campaign.updateStatus("active", performedBy, "Promotion rejected, campaign reopened");
        }
        
        // Add to campaign activity log with performedBy
        campaign.activityLog.push({
          action: "Promotion Rejected",
          details: `Promotion UPI ${promotion.upi} rejected. Funds refunded to marketer. Reason: ${promotion.rejectionReason}.`,
          performedBy: performedBy,
          timestamp: new Date()
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
        
        // Use the model method for consistency
        promotion.markAsPaid(performedBy);
        
        // Update campaign using the recordPromoterPayment method
        campaign.recordPromoterPayment(payoutAmount);
        
        // Add to campaign activity log with performedBy
        campaign.activityLog.push({
          action: "Promotion Paid",
          details: `Payout for promotion UPI ${promotion.upi} confirmed.`,
          performedBy: performedBy,
          timestamp: new Date()
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
    await marketer.save({ session });

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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};