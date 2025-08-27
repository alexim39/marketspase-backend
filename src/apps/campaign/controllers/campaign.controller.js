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
      currency,
    } = req.body;

    // Handle uploaded file
    let mediaUrl = '';
    if (req.file) {
      // Build a public URL for the uploaded file
      mediaUrl = `/uploads/campaigns/${req.file.filename}`;
    }

    const payoutPerPromotion = 200; 
    const maxPromoters = Math.floor(budget / payoutPerPromotion);

    if (!owner || !title || !budget) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Missing required fields.",
        success: false,
      });
    }

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
    if (advertiserWallet.balance < budget) {
      await session.abortTransaction();
      session.endSession();
      return res.status(402).json({
        message: "Insufficient funds. Please fund your wallet to create this campaign.",
        success: false,
      });
    }

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

    // advertiserWallet.balance -= budget;
    // advertiserWallet.reserved += budget;
    advertiserWallet.balance = Number(advertiserWallet.balance) - Number(budget);
    advertiserWallet.reserved = Number(advertiserWallet.reserved) + Number(budget);
    advertiserWallet.transactions.push({
      amount: budget,
      type: "debit",
      category: "campaign",
      description: `Funds reserved for campaign: "${title}"`,
      relatedCampaign: newCampaign._id,
      status: "pending",
    });

    await newCampaign.save({ session });
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      message: "Campaign created successfully. Funds have been reserved and it is now awaiting review.",
      success: true,
      campaignId: newCampaign._id,
      mediaUrl: mediaUrl ? `${req.protocol}://${req.get('host')}${mediaUrl}` : null,
    });

  } catch (error) {
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