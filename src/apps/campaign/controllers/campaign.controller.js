import { CampaignModel } from "../models/campaign.model.js";
import { UserModel } from "../../user/models/user.model.js";
import mongoose from "mongoose";

/**
 * @description Creates a new campaign. This function handles the validation,
 * reserves the campaign budget from the user's wallet, and securely saves
 * the new campaign to the database using a transaction.
 * @param {object} req - The request object from Express.js.
 * @param {object} res - The response object from Express.js.
 * @returns {Promise<void>}
 */
export const createCampaign = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      owner,
      title,
      caption,
      link,
      category,
      budget,
      startDate,
      endDate,
      mediaUrl,
      currency,
    } = req.body;
    
    // Calculate payoutPerPromotion and maxPromoters on the backend for security
    const payoutPerPromotion = 200; 
    const maxPromoters = Math.floor(budget / payoutPerPromotion);

    // 1. Validate required fields
    if (!owner || !title || !budget) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Missing required fields.",
        success: false,
      });
    }

    // 2. Find the user and check their available balance within the transaction
    const user = await UserModel.findById(owner).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        message: "User not found.",
        success: false,
      });
    }

    const advertiserWallet = user.wallets.advertiser;
    // Check if the user's available balance is sufficient
    if (advertiserWallet.balance < budget) {
      await session.abortTransaction();
      session.endSession();
      return res.status(402).json({
        message: "Insufficient funds. Please fund your wallet to create this campaign.",
        success: false,
      });
    }

    // 3. Create the campaign object with the new fields
    const newCampaign = new CampaignModel({
      owner,
      title,
      caption,
      link,
      category,
      budget,
      payoutPerPromotion,
      maxPromoters,
      startDate,
      endDate,
      mediaUrl,
      currency,
      status: "pending", 
      activityLog: [{ action: 'Campaign Created', details: 'Initial campaign creation.' }],
    });

    // 4. Update the user's wallet for escrow (deduct from balance, add to reserved)
    advertiserWallet.balance -= budget;
    advertiserWallet.reserved += budget;
    
    // 5. Create a transaction record with the correct category and status
    advertiserWallet.transactions.push({
      amount: budget,
      type: "debit",
      category: "campaign",
      description: `Funds reserved for campaign: "${title}"`,
      relatedCampaign: newCampaign._id,
      status: "pending", // Set as pending until campaign is completed or canceled
    });

    // 6. Save both documents within the transaction
    await newCampaign.save({ session });
    await user.save({ session });

    // 7. Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // 8. Return a success response
    res.status(201).json({
      message: "Campaign created successfully. Funds have been reserved and it is now awaiting review.",
      success: true,
      campaignId: newCampaign._id,
    });

  } catch (error) {
    // If any error occurs, abort the transaction
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating campaign:", error.message);

    res.status(500).json({
      message: "Error occurred while creating campaign.",
      success: false,
      error: error.message,
    });
  }
};