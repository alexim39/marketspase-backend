// apps/campaign/controllers/accept-campaign.controller.js
import { CampaignModel } from "../models/index.js";
import { PromotionModel } from "../../promotion/models/index.js";
import { UserModel } from "../../user/models/user/index.js";
import { generateUniqueUpi } from "../../promotion/utils/generateUniqueUpi.js";
import {
  buildPromotionTrackingUrl,
  DEFAULT_PROMOTION_TRACKING_PATH,
} from "../../promotion/utils/promotion-url.js";
import { evaluateUserBadges } from "../../badges/service/badge.service.js";
import { awardGamificationProgress } from "../../gamification/service/gamification.service.js";
import {
  resolveCampaignCostPerClick,
  hasValidCampaignCostPerClick,
} from "../services/campaign-pricing.service.js";
import { evaluateCampaignTargetEligibility } from "../services/campaign-targeting-eligibility.service.js";
import {
  deactivateCampaignPromotions,
  getCampaignRemainingBudgetValue,
  normalizeLegacyPpcPromotionStatus,
} from "../services/campaign-runtime.service.js";

const MAX_CREATE_RETRIES = 4;
const MAX_ACCEPTS_PER_CAMPAIGN_PER_USER = Number(
  process.env.MAX_ACCEPTS_PER_CAMPAIGN_PER_USER ?? 3
);
const ACTIVE_PROMOTION_STATUSES = ["accepted", "downloaded", "submitted"];

const getRequestBaseUrl = (req) => {
  const configuredBaseUrl =
    process.env.PROMOTION_TRACKING_BASE_URL ||
    process.env.API_URL ||
    process.env.BACKEND_URL;

  if (configuredBaseUrl) return configuredBaseUrl.replace(/\/$/, "");

  const protocol =
    req.secure || req.headers["x-forwarded-proto"] === "https"
      ? "https"
      : "http";
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

  const normalizedPath = `/${rawValue
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")}`;
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
    trackingPath: normalizePromotionTrackingPath(
      process.env.PROMOTION_TRACKING_PATH
    ),
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

const getCampaignCostPerClick = (campaign) =>
  resolveCampaignCostPerClick(campaign?.costPerClick, campaign?.payoutPerPromotion);

const generatePromotionUpi = async () => {
  for (let attempt = 0; attempt < 8; attempt++) {
    const upi = generateUniqueUpi();
    const exists = await PromotionModel.exists({ upi });
    if (!exists) return upi;
  }

  throw { status: 503, message: "Unable to generate promotion link. Please retry." };
};

const ensurePromotionLink = async ({ promotion, campaign, marketer, req }) => {
  const costPerClick = getCampaignCostPerClick(campaign);
  const upi = promotion.upi || await generatePromotionUpi();
  const promotionUrl = buildPromotionUrl(req, upi);

  promotion.upi = upi;
  promotion.promotionUrl = promotionUrl;
  promotion.publicUrl = `${getPromotionTrackingBaseUrl()}/c/${upi}`;
  promotion.destinationUrl = getDestinationUrl(campaign, marketer);
  promotion.payoutModel = "pay_per_click";
  promotion.costPerClick = costPerClick;
  promotion.payoutAmount = Number(promotion.payoutAmount ?? 0);
  promotion.status = "accepted";
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

  await promotion.save();

  if (!hasValidCampaignCostPerClick(campaign?.costPerClick)) {
    await CampaignModel.updateOne(
      { _id: campaign._id },
      {
        $set: {
          costPerClick,
          payoutModel: "pay_per_click",
        },
      }
    );
  }

  return promotion;
};

const appendPromotionAcceptActivity = async ({
  userId,
  campaign,
  promotion,
  metadata,
}) => {
  await UserModel.updateOne(
    { _id: userId },
    {
      $push: {
        activityLog: {
          $each: [
            {
              action: "campaign_accept",
              description: `Accepted campaign "${campaign.title}"`,
              resourceType: "campaign",
              resourceId: campaign._id,
              metadata,
              timestamp: new Date(),
            },
          ],
          $position: 0,
          $slice: 1000,
        },
      },
      $set: {
        lastSeenAt: new Date(),
      },
    }
  );
};

const scheduleAcceptanceSideEffects = ({
  req,
  campaign,
  promotion,
  alreadyAccepted,
}) => {
  setImmediate(async () => {
    const metadata = {
      promotionId: promotion._id,
      upi: promotion.upi,
      promotionUrl: promotion.promotionUrl,
      destinationUrl: promotion.destinationUrl,
      costPerClick: promotion.costPerClick,
      payoutModel: "pay_per_click",
    };

    const tasks = [
      appendPromotionAcceptActivity({
        userId: req.userId,
        campaign,
        promotion,
        metadata,
      }),
      evaluateUserBadges(req.userId, {
        force: true,
        trigger: alreadyAccepted
          ? "campaign_accept_refresh"
          : "campaign_accepted",
      }),
    ];

    if (!alreadyAccepted) {
      tasks.push(
        awardGamificationProgress({
          userId: req.userId,
          actionKey: "promotion_accepted",
          sourceKey: `promotion:${promotion._id}:accepted`,
          sourceType: "promotion",
          sourceId: promotion._id,
          metadata: {
            campaignId: req.params.campaignId,
            promotionId: promotion._id?.toString?.() || null,
            upi: promotion.upi || null,
            costPerClick: Number(promotion.costPerClick || 0),
          },
        })
      );
    }

    const results = await Promise.allSettled(tasks);
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          `Campaign accept side effect ${index + 1} failed for ${promotion._id}:`,
          result.reason
        );
      }
    });
  });
};

const isDuplicatePromotionError = (error) =>
  error?.code === 11000 &&
  (error?.message?.includes("uniq_campaign_promoter_active") ||
    error?.message?.includes("campaign_1_promoter_1") ||
    error?.keyPattern?.campaign ||
    error?.keyPattern?.upi);

export const acceptCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const userId = req.userId;

    const campaign = await CampaignModel.findById(campaignId).select(`
      _id title owner status link
      budget spentBudget reservedBudget currency
      costPerClick payoutPerPromotion payoutModel
      totalPromotions
      enableTarget ageTarget targetLocations requirements minRating
    `);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    if (campaign.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Campaign is not active",
      });
    }

    const marketer = await UserModel.findById(campaign.owner).select(
      "personalInfo.phone personalInfo.phoneDetails"
    );

    if (!marketer) {
      return res.status(404).json({
        success: false,
        message: "Campaign owner not found",
      });
    }

    const costPerClick = getCampaignCostPerClick(campaign);
    const destinationUrl = getDestinationUrl(campaign, marketer);
    const remainingBudget = getCampaignRemainingBudgetValue(campaign);

    if (remainingBudget < costPerClick) {
      await CampaignModel.updateOne(
        { _id: campaign._id, status: "active" },
        {
          $set: { status: "exhausted", exhaustedAt: new Date() },
          $push: {
            activityLog: {
              action: "Campaign Exhausted",
              details:
                "Campaign does not have enough remaining budget for another click.",
              timestamp: new Date(),
            },
          },
        }
      );
      await deactivateCampaignPromotions({ campaignId: campaign._id });

      return res.status(400).json({
        success: false,
        message: "Campaign budget exhausted",
      });
    }

    const promoter = await UserModel.findById(userId).select(`
      _id role rating ratingCount personalInfo interests professionalInfo tags
      isActive
    `);

    if (!promoter || promoter.role !== "promoter") {
      return res.status(403).json({
        success: false,
        message: "Only promoters can accept campaigns",
      });
    }

    if (promoter.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your promoter account is inactive",
      });
    }

    const eligibilityCheck = evaluateCampaignTargetEligibility({
      campaign,
      promoter,
    });

    if (!eligibilityCheck.eligible) {
      return res.status(403).json({
        success: false,
        message: `You do not meet this campaign's targeting rules: ${eligibilityCheck.reasons.join(", ")}`,
      });
    }

    const existingPromotion = await PromotionModel.findOne({
      campaign: campaign._id,
      promoter: promoter._id,
      status: { $in: ACTIVE_PROMOTION_STATUSES },
    });

    if (existingPromotion) {
      existingPromotion.status = normalizeLegacyPpcPromotionStatus(
        existingPromotion.status,
        existingPromotion.isActive
      );

      const promotion = await ensurePromotionLink({
        promotion: existingPromotion,
        campaign,
        marketer,
        req,
      });

      scheduleAcceptanceSideEffects({
        req,
        campaign,
        promotion,
        alreadyAccepted: true,
      });

      return res.json({
        success: true,
        message: "Campaign already accepted. Promotion link returned.",
        promotion,
        upi: promotion.upi,
        promotionUrl: promotion.promotionUrl,
        destinationUrl: promotion.destinationUrl,
        costPerClick: promotion.costPerClick,
      });
    }

    const lifetimeCount = await PromotionModel.countDocuments({
      campaign: campaign._id,
      promoter: promoter._id,
    });

    if (lifetimeCount >= MAX_ACCEPTS_PER_CAMPAIGN_PER_USER) {
      return res.status(403).json({
        success: false,
        message: `Limit reached: you can only accept this campaign ${MAX_ACCEPTS_PER_CAMPAIGN_PER_USER} times`,
      });
    }

    let promotion = null;
    let created = false;

    for (let attempt = 1; attempt <= MAX_CREATE_RETRIES; attempt++) {
      try {
        const upi = await generatePromotionUpi();
        const promotionUrl = buildPromotionUrl(req, upi);

        promotion = await PromotionModel.create({
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
        });

        created = true;
        break;
      } catch (error) {
        if (!isDuplicatePromotionError(error) || attempt === MAX_CREATE_RETRIES) {
          throw error;
        }

        const duplicatePromotion = await PromotionModel.findOne({
          campaign: campaign._id,
          promoter: promoter._id,
          status: { $in: ACTIVE_PROMOTION_STATUSES },
        });

        if (duplicatePromotion) {
          duplicatePromotion.status = normalizeLegacyPpcPromotionStatus(
            duplicatePromotion.status,
            duplicatePromotion.isActive
          );

          promotion = await ensurePromotionLink({
            promotion: duplicatePromotion,
            campaign,
            marketer,
            req,
          });
          created = false;
          break;
        }
      }
    }

    if (!promotion) {
      return res.status(503).json({
        success: false,
        message: "Unable to accept campaign right now. Please retry.",
      });
    }

    if (created) {
      await CampaignModel.updateOne(
        { _id: campaign._id },
        {
          $inc: { totalPromotions: 1 },
          $set: { payoutModel: "pay_per_click", costPerClick },
        }
      );
    } else if (!hasValidCampaignCostPerClick(campaign?.costPerClick)) {
      await CampaignModel.updateOne(
        { _id: campaign._id },
        {
          $set: { payoutModel: "pay_per_click", costPerClick },
        }
      );
    }

    scheduleAcceptanceSideEffects({
      req,
      campaign,
      promotion,
      alreadyAccepted: !created,
    });

    return res.json({
      success: true,
      message: created
        ? "Campaign accepted successfully"
        : "Campaign already accepted. Promotion link returned.",
      promotion,
      upi: promotion.upi,
      promotionUrl: promotion.promotionUrl,
      destinationUrl: promotion.destinationUrl,
      costPerClick: promotion.costPerClick,
    });
  } catch (err) {
    console.error("Accept campaign error:", err);
    return res.status(err?.status ?? 500).json({
      success: false,
      message: err?.message ?? "Failed to accept campaign",
    });
  }
};
