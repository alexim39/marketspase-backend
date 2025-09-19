import { CampaignModel } from "../models/campaign.model.js";
import { PromotionModel } from "../models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";
import mongoose from "mongoose";
import fs from "fs"; // Add this import
import path from "path"; // Useful for path operations



/**
 * @description Archive a campaign (soft delete)
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
export const archiveCampaign = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { deletionReason } = req.body;
    const performedBy = req.user?._id;

    // Validate input
    if (!id) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Campaign ID is required.",
      });
    }

    // Find the campaign within transaction
    const campaign = await CampaignModel.findById(id).session(session);
    if (!campaign) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Campaign not found.",
      });
    }

    // Check permissions
    if (campaign.owner.toString() !== performedBy?.toString() && req.user?.role !== 'admin') {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this campaign.",
      });
    }

    // Check if campaign can be archived
    if (campaign.status === 'active' && campaign.currentPromoters > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Cannot archive active campaign with promoters. Pause or cancel it first.",
      });
    }

    // Refund unused budget if campaign hasn't started
    let refundAmount = 0;
    if (campaign.status === 'draft' || campaign.status === 'pending') {
      refundAmount = campaign.budget - campaign.spentBudget;
      
      if (refundAmount > 0) {
        const marketer = await UserModel.findById(campaign.owner).session(session);
        marketer.wallets.marketer.reserved -= refundAmount;
        marketer.wallets.marketer.balance += refundAmount;
        
        marketer.wallets.marketer.transactions.push({
          amount: refundAmount,
          type: "credit",
          category: "campaign_refund",
          description: `Refund for archived campaign: "${campaign.title}"`,
          relatedCampaign: campaign._id,
          status: "successful",
        });
        
        await marketer.save({ session });
      }
    }

    // Soft delete the campaign
    campaign.status = "archived";
    campaign.isDeleted = true;
    campaign.deletedAt = new Date();
    campaign.deletedBy = performedBy;

    // Update activity log
    campaign.activityLog.push({
      action: "Campaign Archived",
      details: deletionReason 
        ? `Campaign archived. Reason: ${deletionReason}. Refunded: ${refundAmount} NGN` 
        : `Campaign archived. Refunded: ${refundAmount} NGN`,
      timestamp: new Date(),
      performedBy: performedBy
    });

    await campaign.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: refundAmount > 0 
        ? `Campaign archived successfully. ${refundAmount} NGN refunded to your wallet.`
        : "Campaign archived successfully.",
      data: {
        _id: campaign._id,
        title: campaign.title,
        refundAmount: refundAmount
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error("Error archiving campaign:", error);
    
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign ID format.",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "An error occurred while archiving the campaign.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};




/**
 * @description Permanently delete a campaign (ADMIN ONLY)
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
export const deleteCampaign = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const performedBy = req.user?._id;

    // Validate admin role
    if (req.user?.role !== 'admin') {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "Only administrators can permanently delete campaigns.",
      });
    }

    // Find the campaign and populate related data
    const campaign = await CampaignModel.findById(id)
      .populate('promotions')
      .session(session);

    if (!campaign) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Campaign not found.",
      });
    }

    // Safety checks - prevent deletion of campaigns with activity
    if (campaign.currentPromoters > 0 || campaign.spentBudget > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Cannot delete campaign with active promoters or financial activity.",
      });
    }

    if (campaign.promotions && campaign.promotions.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Cannot delete campaign with existing promotions.",
      });
    }

    // Refund any reserved funds
    const marketer = await UserModel.findById(campaign.owner).session(session);
    if (marketer && campaign.budget > 0) {
      marketer.wallets.marketer.reserved -= campaign.budget;
      marketer.wallets.marketer.balance += campaign.budget;
      
      marketer.wallets.marketer.transactions.push({
        amount: campaign.budget,
        type: "credit",
        category: "campaign_refund",
        description: `Refund for deleted campaign: "${campaign.title}"`,
        status: "successful",
      });
      
      await marketer.save({ session });
    }

    // Delete associated media file
    if (campaign.mediaUrl) {
      const filePath = path.join(process.cwd(), campaign.mediaUrl.replace(/^\//, ''));
      deleteUploadedFile(filePath);
    }

    // Perform deletion
    await CampaignModel.findByIdAndDelete(id).session(session);
    
    await session.commitTransaction();
    session.endSession();

    // Audit log (you might want to save this to a separate audit collection)
    console.log(`Campaign ${id} deleted by admin ${performedBy}`);

    res.status(200).json({
      success: true,
      message: "Campaign permanently deleted successfully.",
      refundAmount: campaign.budget
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error("Error deleting campaign:", error);
    
    res.status(500).json({
      success: false,
      message: "An error occurred while deleting the campaign.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};