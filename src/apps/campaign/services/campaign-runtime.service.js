import { PromotionModel } from "../../promotion/models/index.js";
import { resolveCampaignCostPerClick } from "./campaign-pricing.service.js";

export const LEGACY_PPC_PROMOTION_STATUSES = new Set([
  "downloaded",
  "submitted",
  "validated",
]);

export const NON_REACTIVATABLE_PROMOTION_STATUSES = new Set([
  "rejected",
  "paid",
]);

const DEFAULT_FRONTEND_URL = "https://marketspase.com";
const DEFAULT_UNAVAILABLE_PATH = "/campaigns/unavailable";
const WHATSAPP_CHAT_BASE_URL = process.env.WHATSAPP_CHAT_BASE_URL || "https://wa.me";

const stripTrailingSlash = (value = "") => String(value).replace(/\/+$/, "");

export const getCampaignRemainingBudgetValue = (campaign) => {
  const budget = Number(campaign?.budget ?? 0);
  const spentBudget = Number(campaign?.spentBudget ?? 0);
  return Math.max(budget - spentBudget, 0);
};

export const getCampaignCostPerClickValue = (campaign) =>
  resolveCampaignCostPerClick(campaign?.costPerClick, campaign?.payoutPerPromotion);

export const normalizeLegacyPpcPromotionStatus = (status, isActive = true) => {
  const normalizedStatus = String(status || "").trim().toLowerCase();

  if (LEGACY_PPC_PROMOTION_STATUSES.has(normalizedStatus) && isActive !== false) {
    return "accepted";
  }

  return normalizedStatus || "accepted";
};

const buildSellerContactUrl = (marketer) => {
  const phone =
    marketer?.personalInfo?.phone ||
    marketer?.personalInfo?.phoneDetails?.fullNumber ||
    marketer?.personalInfo?.phoneDetails?.nationalNumber;

  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  return `${stripTrailingSlash(WHATSAPP_CHAT_BASE_URL)}/${digits}`;
};

const canExposeSellerContact = (campaign, marketer) => {
  if (!marketer) {
    return false;
  }

  if (campaign?.link && String(campaign.link).trim()) {
    return false;
  }

  return Boolean(buildSellerContactUrl(marketer));
};

export const buildCampaignUnavailableUrl = ({
  campaign,
  marketer,
  reason = "inactive",
} = {}) => {
  const frontendBaseUrl = stripTrailingSlash(process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL);
  const unavailablePath = process.env.CAMPAIGN_UNAVAILABLE_PATH || DEFAULT_UNAVAILABLE_PATH;
  const unavailableUrl = new URL(`${frontendBaseUrl}${unavailablePath}`);

  unavailableUrl.searchParams.set("reason", reason);

  if (campaign?._id) {
    unavailableUrl.searchParams.set("campaignId", String(campaign._id));
  }

  if (campaign?.title) {
    unavailableUrl.searchParams.set("title", String(campaign.title));
  }

  if (canExposeSellerContact(campaign, marketer)) {
    unavailableUrl.searchParams.set("contactUrl", buildSellerContactUrl(marketer));
  }

  return unavailableUrl.toString();
};

export const deactivateCampaignPromotions = async ({
  campaignId,
  session,
}) => {
  if (!campaignId) {
    return { matchedCount: 0, modifiedCount: 0 };
  }

  return PromotionModel.updateMany(
    { campaign: campaignId, isActive: true },
    { $set: { isActive: false } },
    session ? { session } : undefined
  );
};

export const reactivateCampaignPromotions = async ({
  campaignId,
  session,
}) => {
  if (!campaignId) {
    return { matchedCount: 0, modifiedCount: 0 };
  }

  return PromotionModel.updateMany(
    {
      campaign: campaignId,
      isActive: false,
      status: { $nin: Array.from(NON_REACTIVATABLE_PROMOTION_STATUSES) },
      $or: [
        { "fraudStatus.reviewStatus": { $exists: false } },
        { "fraudStatus.reviewStatus": { $nin: ["warning", "final_warning", "blocked"] } },
      ],
    },
    { $set: { isActive: true } },
    session ? { session } : undefined
  );
};
