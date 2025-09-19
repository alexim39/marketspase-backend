import { CampaignModel } from "../models/campaign.model.js";
import { PromotionModel } from "../models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";
import mongoose from "mongoose";
import fs from "fs"; // Add this import
import path from "path"; // Useful for path operations


/**
 * Controller to change the status of a campaign.
 * This function allows an admin or campaign owner to update the campaign's status.
 */
export const updateCampaignStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Extract the campaign ID from the request parameters
    const { id } = req.params;
    // 2. Extract the new status and optional details from the request body
    const { status, details = "" } = req.body;
    // 3. Get the user ID from the request (assuming it's set by authentication middleware)
    const performedBy = req.user?._id;

    // 4. Validate that both ID and status are provided
    if (!id || !status) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Campaign ID and new status are required.",
      });
    }

    // 5. Validate that the new status is a valid enum value
    const validStatuses = [
      "active", "paused", "rejected", "completed", 
      "exhausted", "expired", "pending", "draft", "validated"
    ];
    if (!validStatuses.includes(status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid status provided.",
      });
    }

    // 6. Find the campaign by ID within the transaction
    const campaign = await CampaignModel.findById(id).session(session);

    // 7. Handle the case where the campaign is not found
    if (!campaign) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Campaign not found.",
      });
    }

    // 8. Check if the status is actually changing
    if (campaign.status === status) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Campaign is already in '${status}' status.`,
      });
    }

    // 9. Use the model's updateStatus method for consistency
    campaign.updateStatus(status, performedBy, details);

    // 10. Special handling for status changes that might affect wallet balances
    if (status === "rejected" || status === "cancelled") {
      // If campaign is rejected/cancelled, refund reserved funds to marketer
      const marketer = await UserModel.findById(campaign.owner).session(session);
      if (marketer) {
        const refundAmount = campaign.budget - campaign.spentBudget;
        if (refundAmount > 0) {
          marketer.wallets.marketer.reserved -= refundAmount;
          marketer.wallets.marketer.balance += refundAmount;
          
          marketer.wallets.marketer.transactions.push({
            amount: refundAmount,
            type: "credit",
            category: "campaign_refund",
            description: `Funds refunded for ${status} campaign: "${campaign.title}"`,
            relatedCampaign: campaign._id,
            status: "successful",
          });
          
          await marketer.save({ session });
        }
      }
    }

    // 11. Save the updated campaign document within the transaction
    await campaign.save({ session });

    // 12. Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // 13. Send a success response
    res.status(200).json({
      success: true,
      message: `Campaign status updated to '${status}' successfully.`,
      data: {
        _id: campaign._id,
        title: campaign.title,
        status: campaign.status,
        remainingBudget: campaign.remainingBudget,
        spentBudget: campaign.spentBudget
      },
    });
  } catch (error) {
    // 14. Rollback transaction on error
    await session.abortTransaction();
    session.endSession();
    
    // 15. Handle errors, such as invalid ID format
    console.error("Error updating campaign status:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign ID format.",
      });
    }
    // 16. Handle other generic server errors
    res.status(500).json({
      success: false,
      message: "An error occurred while updating the campaign status.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


/**
 * @description Update an existing campaign
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
export const updateCampaign = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  // Helper function to safely delete files
  const deleteUploadedFile = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.error("Error deleting file:", error.message);
      }
    }
  };

  try {
    const { id } = req.params;
    const {
      title,
      caption,
      category,
      link,
      mediaType,
      budget,
      campaignType,
      enableTarget,
      startDate,
      endDate,
      hasEndDate,
      requirements,
      minRating,
      priority,
      targetLocations
    } = req.body;

    const {performedBy} = req.params;// User performing the update

    // Validate required fields
    if (!id) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Campaign ID is required.",
      });
    }

    if (!title || !category || !budget) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Title, category, and budget are required fields.",
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

    // Check if user has permission to update this campaign
    if (campaign.owner.toString() !== performedBy?.toString() && req.user?.role !== 'admin') {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this campaign.",
      });
    }

    // Handle media file upload if provided
    let mediaUrl = campaign.mediaUrl;
    let newMediaType = campaign.mediaType;
    
    if (req.file) {
      // Delete old media file if it exists
      if (campaign.mediaUrl) {
        const oldFilePath = path.join(process.cwd(), campaign.mediaUrl.replace(/^\//, ''));
        deleteUploadedFile(oldFilePath);
      }

      // Build a public URL for the new file
      mediaUrl = `/uploads/campaigns/${req.file.filename}`;
      
      // Determine media type from file mimetype
      if (req.file.mimetype.startsWith('image/')) {
        newMediaType = 'image';
      } else if (req.file.mimetype.startsWith('video/')) {
        newMediaType = 'video';
      }
    }

    // Process requirements array if provided as string or array
    const requirementsArray = Array.isArray(requirements) 
      ? requirements 
      : (typeof requirements === 'string' ? requirements.split(',').map(req => req.trim()).filter(req => req.length > 0) : campaign.requirements);

    // Process target locations
    const targetLocationsArray = Array.isArray(targetLocations) 
      ? targetLocations 
      : (typeof targetLocations === 'string' ? targetLocations.split(',').map(loc => loc.trim()) : campaign.targetLocations || []);

    // Calculate new maxPromoters if budget or payout changes
    const payoutPerPromotion = campaign.payoutPerPromotion; // Keep existing payout or could make this editable
    const newMaxPromoters = Math.floor(budget / payoutPerPromotion);

    // Check if the new budget can cover existing commitments
    if (budget < campaign.spentBudget) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `New budget (${budget}) cannot be less than already spent amount (${campaign.spentBudget}).`,
      });
    }

    // Check if reducing max promoters below current promoters
    if (newMaxPromoters < campaign.currentPromoters) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `New budget allows only ${newMaxPromoters} promoters, but there are already ${campaign.currentPromoters} promoters assigned.`,
      });
    }

    // Update campaign fields
    campaign.title = title;
    campaign.caption = caption || "";
    campaign.category = category;
    campaign.link = link || "";
    campaign.mediaUrl = mediaUrl;
    campaign.mediaType = newMediaType;
    campaign.budget = Number(budget);
    campaign.campaignType = campaignType || "standard";
    campaign.enableTarget = Boolean(enableTarget);
    campaign.targetLocations = targetLocationsArray;
    campaign.requirements = requirementsArray;
    campaign.minRating = Number(minRating) || 0;
    campaign.priority = priority || "medium";
    campaign.hasEndDate = Boolean(hasEndDate);
    campaign.maxPromoters = newMaxPromoters;
    
    // Handle dates
    if (startDate) {
      campaign.startDate = new Date(startDate);
    }
    
    if (endDate && hasEndDate) {
      campaign.endDate = new Date(endDate);
    } else if (!hasEndDate) {
      campaign.endDate = undefined;
    }

    // Update activity log
    campaign.activityLog.push({
      action: "Campaign Updated",
      details: "Campaign details were modified",
      timestamp: new Date(),
      performedBy: performedBy
    });

    // Update updatedBy field
    campaign.updatedBy = performedBy;

    // Save the updated campaign
    await campaign.save({ session });

    // Handle budget adjustments if needed
    if (budget > campaign.budget) {
      // Additional funds needed - reserve from marketer's wallet
      const additionalAmount = budget - campaign.budget;
      const marketer = await UserModel.findById(campaign.owner).session(session);
      
      if (marketer.wallets.marketer.balance < additionalAmount) {
        await session.abortTransaction();
        session.endSession();
        return res.status(402).json({
          success: false,
          message: "Insufficient funds to increase campaign budget.",
        });
      }

      marketer.wallets.marketer.balance -= additionalAmount;
      marketer.wallets.marketer.reserved += additionalAmount;
      
      marketer.wallets.marketer.transactions.push({
        amount: additionalAmount,
        type: "debit",
        category: "campaign_budget_increase",
        description: `Additional funds reserved for campaign: "${campaign.title}"`,
        relatedCampaign: campaign._id,
        status: "successful",
      });

      await marketer.save({ session });
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Campaign updated successfully.",
      data: {
        _id: campaign._id,
        title: campaign.title,
        status: campaign.status,
        budget: campaign.budget,
        spentBudget: campaign.spentBudget,
        remainingBudget: campaign.remainingBudget,
        maxPromoters: campaign.maxPromoters,
        currentPromoters: campaign.currentPromoters,
        mediaUrl: mediaUrl ? `${req.protocol}://${req.get('host')}${mediaUrl}` : null,
        mediaType: newMediaType
      },
    });

  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    session.endSession();
    
    // Clean up uploaded file if error occurred
    if (req.file) {
      deleteUploadedFile(req.file.path);
    }

    console.error("Error updating campaign:", error);
    
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign ID format.",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "An error occurred while updating the campaign.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};