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
export const UpdateCampaignStatus = async (req, res) => {
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
