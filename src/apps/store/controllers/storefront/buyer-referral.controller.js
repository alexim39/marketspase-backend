import { BuyerReferralModel } from "../../models/buyer-referral/index.js";
import { roundMoney } from "../../services/storefront-affiliate.service.js";

export const validateReferralCode = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Referral code is required",
      });
    }

    const referral = await BuyerReferralModel.findOne({
      code: code.trim().toLowerCase(),
    });

    if (!referral) {
      return res.status(200).json({
        success: true,
        data: { valid: false, reason: "Referral code not found" },
      });
    }

    if (referral.status !== "active") {
      return res.status(200).json({
        success: true,
        data: {
          valid: false,
          reason:
            referral.status === "expired"
              ? "Referral code has expired"
              : "Referral code has already been used",
        },
      });
    }

    if (referral.expiresAt && referral.expiresAt < new Date()) {
      referral.status = "expired";
      await referral.save();
      return res.status(200).json({
        success: true,
        data: { valid: false, reason: "Referral code has expired" },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        valid: true,
        discountPercent: referral.discountPercent,
        rewardAmount: referral.rewardAmount,
      },
    });
  } catch (error) {
    console.error("Validate referral code error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to validate referral code",
    });
  }
};

export const getMyReferrals = async (req, res) => {
  try {
    const userId = req.userId;

    const referrals = await BuyerReferralModel.find({
      referrerUserId: userId,
    })
      .populate("referredUserId", "displayName username email")
      .populate("orderId", "orderNumber totalAmount currency createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const totalRewardCredits = referrals
      .filter((r) => r.status === "used")
      .reduce((sum, r) => sum + (r.rewardAmount || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        referrals,
        totalRewardCredits: roundMoney(totalRewardCredits),
      },
    });
  } catch (error) {
    console.error("Get my referrals error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch referrals",
    });
  }
};

export const createReferralCode = async (req, res) => {
  try {
    const userId = req.userId;
    const { discountPercent, rewardAmount } = req.body;

    const code = new BuyerReferralModel({
      referrerUserId: userId,
      discountPercent: discountPercent || 5,
      rewardAmount: rewardAmount || 500,
    });

    await code.save();

    return res.status(201).json({
      success: true,
      message: "Referral code created successfully",
      data: code,
    });
  } catch (error) {
    console.error("Create referral code error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create referral code",
    });
  }
};
