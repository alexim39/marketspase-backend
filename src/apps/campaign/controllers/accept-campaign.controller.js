// apps/campaign/controllers/accept-campaign.controller.js
import mongoose from "mongoose";
import { CampaignModel } from "../models/index.js";
import { PromotionModel } from "../../promotion/models/index.js";
import { UserModel } from "../../user/models/user/index.js";
import { logUserActivity } from "../../user/services/activity.service.js";
import { generateUniqueUpi } from "../../promotion/utils/generateUniqueUpi.js";
import {
  buildPromotionTrackingUrl,
  DEFAULT_PROMOTION_TRACKING_PATH,
} from "../../promotion/utils/promotion-url.js";
import { evaluateUserBadges } from "../../badges/service/badge.service.js";
import { awardGamificationProgress } from "../../gamification/service/gamification.service.js";
import { resolveCampaignCostPerClick, hasValidCampaignCostPerClick } from "../services/campaign-pricing.service.js";
import { refreshUserReputation } from "../../user/services/user-reputation.service.js";
import { evaluateCampaignTargetEligibility } from "../services/campaign-targeting-eligibility.service.js";

const MAX_TX_RETRIES = 5;
const MAX_ACCEPTS_PER_CAMPAIGN_PER_USER = Number(process.env.MAX_ACCEPTS_PER_CAMPAIGN_PER_USER ?? 3);
const ACTIVE_PROMOTION_STATUSES = ["accepted", "submitted", "downloaded"];
const isRetryableTxnError = (err) =>
  err?.errorLabels?.includes("TransientTransactionError") ||
  err?.errorLabels?.includes("UnknownTransactionCommitResult") ||
  /Write conflict/i.test(err?.message ?? "");

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const getRequestBaseUrl = (req) => {
  const configuredBaseUrl =
    process.env.PROMOTION_TRACKING_BASE_URL ||
    process.env.API_URL ||
    process.env.BACKEND_URL;

  if (configuredBaseUrl) return configuredBaseUrl.replace(/\/$/, "");

  const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  return `${protocol}://${req.get("host")}`;
};

const normalizePromotionTrackingPath = (value) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return DEFAULT_PROMOTION_TRACKING_PATH;

  if (/^https?:\/\//i.test(rawValue)) {
    const url = new URL(rawValue);
    const normalizedPath = normalizePromotionTrackingPath(url.pathname);
    url.pathname = normalizedPath;
    return url.toString().replace(/\/+$/, "");
  }

  const normalizedPath = `/${rawValue.replace(/^\/+/, "").replace(/\/+$/, "")}`;
  if (normalizedPath === "/campaign/track") {
    return DEFAULT_PROMOTION_TRACKING_PATH;
  }

  if (normalizedPath.startsWith("/campaign/")) {
    return `/api/v1${normalizedPath}`;
  }

  return normalizedPath;
};

const buildPromotionUrl = (req, upi) => {
  const baseUrl = getRequestBaseUrl(req);
  return buildPromotionTrackingUrl({
    baseUrl,
    upi,
    trackingPath: normalizePromotionTrackingPath(process.env.PROMOTION_TRACKING_PATH),
  });
};

const buildWhatsAppDestinationUrl = (user) => {
  const phone =
    user?.personalInfo?.phone ||
    user?.personalInfo?.phoneDetails?.fullNumber ||
    user?.personalInfo?.phoneDetails?.nationalNumber;

  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return process.env.FRONTEND_URL || "https://marketspase.com";

  const baseUrl = process.env.WHATSAPP_CHAT_BASE_URL || "https://wa.me";
  return `${baseUrl.replace(/\/$/, "")}/${digits}`;
};

const getDestinationUrl = (campaign, marketer) => {
  if (typeof campaign.link === "string" && campaign.link.trim()) {
    return campaign.link.trim();
  }

  return buildWhatsAppDestinationUrl(marketer);
};

const getCampaignRemainingBudget = (campaign) =>
  Number(campaign.budget ?? 0) -
  (Number(campaign.spentBudget ?? 0) + Number(campaign.reservedBudget ?? 0));

const getCampaignCostPerClick = (campaign) =>
  resolveCampaignCostPerClick(campaign?.costPerClick, campaign?.payoutPerPromotion);

const generatePromotionUpi = async (session) => {
  for (let attempt = 0; attempt < 8; attempt++) {
    const upi = generateUniqueUpi();
    const exists = await PromotionModel.exists({ upi }).session(session);
    if (!exists) return upi;
  }

  throw { status: 503, message: "Unable to generate promotion link. Please retry." };
};

const ensurePromotionLink = async ({ promotion, campaign, marketer, req, session }) => {
  const costPerClick = getCampaignCostPerClick(campaign);
  const upi = promotion.upi || await generatePromotionUpi(session);
  const promotionUrl = buildPromotionUrl(req, upi);

  promotion.upi = upi;
  promotion.promotionUrl = promotionUrl;
  promotion.destinationUrl = getDestinationUrl(campaign, marketer);
  promotion.payoutModel = "pay_per_click";
  promotion.costPerClick = costPerClick;
  promotion.payoutAmount = Number(promotion.payoutAmount ?? 0);
  promotion.isActive = true;
  promotion.hasReservedFromMarketer = false;
  promotion.hasReservedForPromoter = false;
  promotion.payoutSnapshot = {
    model: "pay_per_click",
    costPerClick,
    lockedAt: promotion.payoutSnapshot?.lockedAt || new Date(),
  };

  if (!promotion.clickStats) {
    promotion.clickStats = {
      totalClicks: 0,
      billableClicks: 0,
      invalidClicks: 0,
      duplicateClicks: 0,
      earnedAmount: 0,
    };
  }

  await promotion.save({ session });

  if (!hasValidCampaignCostPerClick(campaign?.costPerClick)) {
    campaign.costPerClick = costPerClick;
    campaign.payoutModel = "pay_per_click";
    await campaign.save({ session });
  }

  return promotion;
};

export const acceptCampaign = async (req, res) => {
  for (let attempt = 1; attempt <= MAX_TX_RETRIES; attempt++) {
    const session = await mongoose.startSession();
    let txResult = null;

    try {
      await session.withTransaction(async () => {
        const { campaignId } = req.params;
        const userId = req.userId;

        const campaign = await CampaignModel.findById(campaignId)
          .session(session)
          .select(`
            _id title owner status link
            budget spentBudget reservedBudget currency
            costPerClick payoutPerPromotion payoutModel
            maxPromoters currentPromoters totalPromotions
            enableTarget ageTarget targetLocations requirements minRating
          `);

        if (!campaign) throw { status: 404, message: "Campaign not found" };
        if (campaign.status !== "active") {
          throw { status: 400, message: "Campaign is not active" };
        }

        const marketer = await UserModel.findById(campaign.owner)
          .session(session)
          .select("personalInfo.phone personalInfo.phoneDetails");

        if (!marketer) {
          throw { status: 404, message: "Campaign owner not found" };
        }

        const costPerClick = getCampaignCostPerClick(campaign);
        const destinationUrl = getDestinationUrl(campaign, marketer);
        const remainingBudget = getCampaignRemainingBudget(campaign);
        if (remainingBudget < costPerClick) {
          await CampaignModel.updateOne(
            { _id: campaign._id, status: "active" },
            {
              $set: { status: "exhausted", exhaustedAt: new Date() },
              $push: {
                activityLog: {
                  action: "Campaign Exhausted",
                  details: "Campaign does not have enough remaining budget for another click.",
                  timestamp: new Date(),
                },
              },
            },
            { session }
          );
          throw { status: 400, message: "Campaign budget exhausted" };
        }

        const hasPromoterLimit = Number.isFinite(Number(campaign.maxPromoters)) && Number(campaign.maxPromoters) > 0;
        if (hasPromoterLimit && Number(campaign.currentPromoters ?? 0) >= Number(campaign.maxPromoters)) {
          throw { status: 400, message: "Campaign has reached promoter limit" };
        }

        const promoter = await UserModel.findById(userId)
          .session(session)
          .select(`
            _id role rating ratingCount personalInfo interests professionalInfo tags
            loginStreak gamificationProfile isActive
          `);

        if (!promoter || promoter.role !== "promoter") {
          throw { status: 403, message: "Only promoters can accept campaigns" };
        }

        const reputationSnapshot = await refreshUserReputation({
          _id: promoter._id,
          role: promoter.role,
          loginStreak: promoter.loginStreak,
          gamificationProfile: promoter.gamificationProfile,
        });

        promoter.rating = reputationSnapshot.rating;
        promoter.ratingCount = reputationSnapshot.ratingCount;

        const eligibilityCheck = evaluateCampaignTargetEligibility({
          campaign,
          promoter,
        });

        if (!eligibilityCheck.eligible) {
          throw {
            status: 403,
            message: `You do not meet this campaign's targeting rules: ${eligibilityCheck.reasons.join(", ")}`,
          };
        }

        const existingPromotion = await PromotionModel.findOne({
          campaign: campaign._id,
          promoter: promoter._id,
          status: { $in: ACTIVE_PROMOTION_STATUSES },
        }).session(session);

        if (existingPromotion) {
          const promotion = await ensurePromotionLink({
            promotion: existingPromotion,
            campaign,
            marketer,
            req,
            session,
          });

          txResult = { promotion, alreadyAccepted: true };
          return;
        }

        const lifetimeCount = await PromotionModel.countDocuments({
          campaign: campaign._id,
          promoter: promoter._id,
        }).session(session);

        if (lifetimeCount >= MAX_ACCEPTS_PER_CAMPAIGN_PER_USER) {
          throw {
            status: 403,
            message: `Limit reached: you can only accept this campaign ${MAX_ACCEPTS_PER_CAMPAIGN_PER_USER} times`,
          };
        }

        const upi = await generatePromotionUpi(session);
        const promotionUrl = buildPromotionUrl(req, upi);

        const promotion = await new PromotionModel({
          campaign: campaign._id,
          promoter: promoter._id,
          upi,
          status: "accepted",
          acceptedAt: new Date(),
          payoutModel: "pay_per_click",
          costPerClick,
          payoutAmount: 0,
          payoutSnapshot: {
            model: "pay_per_click",
            costPerClick,
            lockedAt: new Date(),
          },
          promotionUrl,
          destinationUrl,
          isActive: true,
          viewsAchieved: 0,
          isDownloaded: false,
          hasReservedFromMarketer: false,
          hasReservedForPromoter: false,
          hasBeenPaid: false,
          clickStats: {
            totalClicks: 0,
            billableClicks: 0,
            invalidClicks: 0,
            duplicateClicks: 0,
            earnedAmount: 0,
          },
        }).save({ session });

        await CampaignModel.updateOne(
          { _id: campaign._id },
          {
            $inc: { currentPromoters: 1, totalPromotions: 1 },
            $set: { payoutModel: "pay_per_click", costPerClick },
          },
          { session }
        );

        await logUserActivity({
          session,
          userId: promoter._id,
          action: "campaign_accept",
          description: `Accepted campaign "${campaign.title}"`,
          resourceType: "campaign",
          resourceId: campaign._id,
          metadata: {
            promotionId: promotion._id,
            upi,
            promotionUrl,
            destinationUrl,
            costPerClick,
            payoutModel: "pay_per_click",
          },
        });

        txResult = { promotion, alreadyAccepted: false };
      },
      {
        maxCommitTimeMS: 8000,
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      });

      session.endSession();

      setImmediate(() => {
        UserModel.updateOne(
          { _id: req.userId },
          { $set: { lastSeenAt: new Date() } }
        ).catch(err => console.error("lastSeenAt update failed:", err.message));
      });

      if (!txResult.alreadyAccepted) {
        await awardGamificationProgress({
          userId: req.userId,
          actionKey: 'promotion_accepted',
          sourceKey: `promotion:${txResult.promotion._id}:accepted`,
          sourceType: 'promotion',
          sourceId: txResult.promotion._id,
          metadata: {
            campaignId: req.params.campaignId,
            promotionId: txResult.promotion._id?.toString?.() || null,
            upi: txResult.promotion.upi || null,
            costPerClick: Number(txResult.promotion.costPerClick || 0),
          },
        }).catch((gamificationError) => {
          console.error("Gamification update after campaign acceptance failed:", gamificationError);
        });
      }

      await evaluateUserBadges(req.userId, {
        force: true,
        trigger: txResult.alreadyAccepted ? 'campaign_accept_refresh' : 'campaign_accepted',
      }).catch((badgeError) => {
        console.error("Badge evaluation after campaign acceptance failed:", badgeError);
      });

      return res.json({
        success: true,
        message: txResult.alreadyAccepted
          ? "Campaign already accepted. Promotion link returned."
          : "Campaign accepted successfully",
        promotion: txResult.promotion,
        upi: txResult.promotion.upi,
        promotionUrl: txResult.promotion.promotionUrl,
        destinationUrl: txResult.promotion.destinationUrl,
        costPerClick: txResult.promotion.costPerClick,
      });

    } catch (err) {
      session.endSession();

      if (isRetryableTxnError(err) && attempt < MAX_TX_RETRIES) {
        await delay(50 * 2 ** attempt);
        continue;
      }

      return res.status(err?.status ?? 500).json({
        success: false,
        message: err?.message ?? "Failed to accept campaign",
      });
    }
  }

  return res.status(503).json({
    success: false,
    message: "System busy. Please retry.",
  });
};
