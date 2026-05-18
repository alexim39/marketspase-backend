import { sendEmail } from "../../../core/email.service.js";
import { evaluateUserBadges } from "../../badges/service/badge.service.js";
import { awardGamificationProgress } from "../../gamification/service/gamification.service.js";
import { UserModel } from "../../user/models/user/index.js";
import { adminCampaignApprovalTemplate } from "./email/adminCampaignApprovalTemplate.js";
import { resolveCampaignCostPerClick } from "./campaign-pricing.service.js";
import { buildVideoThumbnailUrl } from "./thumbnail-generator.service.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

const MIN_CAMPAIGN_BUDGET = 1000;

const normalizeCampaignGoal = (campaignGoal) =>
  campaignGoal === "leads" ? "leads" : "awareness";

const buildHttpError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no", "off", ""].includes(normalized)) {
      return false;
    }
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return fallback;
};

const parseJsonArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return trimmed
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
};

const normalizeRequirements = (value) =>
  parseJsonArray(value)
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);

const normalizeTargetLocations = (value) =>
  parseJsonArray(value)
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      id: entry.id ?? entry.place_id ?? entry.name ?? "",
      name: entry.name ?? "",
      type: entry.type ?? "manual",
      place_id: entry.place_id ?? entry.id ?? entry.name ?? "",
      coordinates: {
        lat: Number(entry?.coordinates?.lat ?? entry?.lat ?? 0),
        lng: Number(entry?.coordinates?.lng ?? entry?.lng ?? 0),
      },
      precision: entry.precision ?? "medium",
    }))
    .filter((entry) => entry.id && entry.name && entry.place_id);

const normalizeOptionalString = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const normalizeDate = (value, fieldName) => {
  const date = value ? new Date(value) : null;

  if (date && Number.isNaN(date.getTime())) {
    throw buildHttpError(`Invalid ${fieldName}.`, 400);
  }

  return date;
};

export const resolveCampaignMediaAsset = async ({
  req,
  owner,
  requireMedia = true,
  allowExistingMedia = true,
}) => {
  const mediaUrl = normalizeOptionalString(req.body?.mediaUrl);
  const mediaType = normalizeOptionalString(req.body?.mediaType);
  const mediaPublicId = normalizeOptionalString(req.body?.mediaPublicId);
  const thumbnailUrl = normalizeOptionalString(req.body?.thumbnailUrl);

  if (allowExistingMedia && mediaUrl && mediaType) {
    return {
      mediaUrl,
      mediaType,
      mediaPublicId: mediaPublicId || undefined,
      thumbnailUrl:
        thumbnailUrl ||
        (mediaType === "video" && mediaPublicId
          ? buildVideoThumbnailUrl(mediaPublicId)
          : mediaUrl),
    };
  }

  if (!req.file) {
    if (requireMedia) {
      throw buildHttpError("Campaign media (image or video) is required.", 400);
    }

    return null;
  }

  try {
    const uploadResult = await uploadToCloudinary(
      req.file.path,
      `campaigns/${owner}`
    );

    const resolvedMediaType = uploadResult.resource_type;

    return {
      mediaUrl: uploadResult.secure_url,
      mediaType: resolvedMediaType,
      mediaPublicId: uploadResult.public_id,
      thumbnailUrl:
        resolvedMediaType === "video"
          ? buildVideoThumbnailUrl(uploadResult.public_id)
          : uploadResult.secure_url,
    };
  } catch (uploadError) {
    console.error("Campaign media upload failed:", uploadError);
    throw buildHttpError("Failed to upload campaign media.", 500);
  }
};

export const buildCampaignDraftInput = async ({
  req,
  status,
  enforceWalletBalance,
}) => {
  const {
    title,
    caption,
    link,
    category,
    budget,
    costPerClick,
    startDate,
    endDate,
    currency = "NGN",
    enableTarget = false,
    campaignType = "standard",
    priority = "medium",
    campaignGoal = "awareness",
    minRating = 0,
    requirements = [],
    targetLocations = [],
    hasEndDate,
    ageTarget = "all",
  } = req.body ?? {};

  const owner = req.userId;

  if (!owner || !title || !budget || !category) {
    throw buildHttpError("Missing required fields.", 400);
  }

  const numericBudget = Number(budget);
  if (!Number.isFinite(numericBudget) || numericBudget < MIN_CAMPAIGN_BUDGET) {
    throw buildHttpError("Minimum campaign budget is NGN 1000.", 400);
  }

  const marketer = await UserModel.findById(owner)
    .select("email wallets.marketer.balance")
    .lean();

  if (!marketer) {
    throw buildHttpError("Campaign owner not found.", 404);
  }

  const marketerBalance = Number(marketer?.wallets?.marketer?.balance ?? 0);
  if (enforceWalletBalance && marketerBalance < numericBudget) {
    throw buildHttpError(
      "Insufficient wallet balance to create this campaign.",
      400
    );
  }

  const mediaAsset = await resolveCampaignMediaAsset({ req, owner });
  const normalizedCampaignGoal = normalizeCampaignGoal(campaignGoal);
  const numericCostPerClick = resolveCampaignCostPerClick(
    costPerClick,
    req.body?.payoutPerPromotion
  );
  const estimatedViews = Math.floor(numericBudget / numericCostPerClick);

  const resolvedStartDate = normalizeDate(startDate, "start date") ?? new Date();
  const shouldHaveEndDate =
    normalizeBoolean(hasEndDate, false) || Boolean(endDate);
  const resolvedEndDate = shouldHaveEndDate
    ? normalizeDate(endDate, "end date")
    : null;

  if (shouldHaveEndDate && !resolvedEndDate) {
    throw buildHttpError("End date is required when end date is enabled.", 400);
  }

  return {
    marketer,
    campaignData: {
      owner,
      title: normalizeOptionalString(title),
      caption: normalizeOptionalString(caption),
      link: normalizeOptionalString(link),
      category: normalizeOptionalString(category),
      mediaUrl: mediaAsset.mediaUrl,
      mediaType: mediaAsset.mediaType,
      mediaPublicId: mediaAsset.mediaPublicId,
      thumbnailUrl: mediaAsset.thumbnailUrl,
      budget: numericBudget,
      currency: normalizeOptionalString(currency) || "NGN",
      payoutModel: "pay_per_click",
      costPerClick: numericCostPerClick,
      estimatedViews,
      enableTarget: normalizeBoolean(enableTarget, false),
      ageTarget: normalizeOptionalString(ageTarget) || "all",
      campaignGoal: normalizedCampaignGoal,
      targetLocations: normalizeTargetLocations(targetLocations),
      requirements: normalizeRequirements(requirements),
      minRating: Number(minRating) || 0,
      campaignType: normalizeOptionalString(campaignType) || "standard",
      priority: normalizeOptionalString(priority) || "medium",
      startDate: resolvedStartDate,
      endDate: resolvedEndDate,
      hasEndDate: shouldHaveEndDate,
      status,
      createdBy: owner,
      activityLog: [
        {
          action:
            status === "draft" ? "Campaign Created as draft" : "Campaign Created",
          details: `Campaign created with budget NGN ${numericBudget}`,
          timestamp: new Date(),
          performedBy: owner,
        },
      ],
    },
  };
};

const buildAdminNotificationPayload = (campaign, subject) => ({
  to: ["schooltraz@gmail.com"],
  subject,
  html: adminCampaignApprovalTemplate({
    title: campaign.title,
    campaignId: campaign._id?.toString?.() || "",
    marketerName: campaign.owner?.toString?.() || "",
    budget: campaign.budget,
    owner: campaign.owner,
    category: campaign.category,
    costPerClick: campaign.costPerClick,
    mediaType: campaign.mediaType,
    caption: campaign.caption,
    requirements: campaign.requirements,
    targetLocations: campaign.targetLocations,
  }),
});

export const scheduleCampaignCreationSideEffects = ({
  campaign,
  userId,
  includeGamification = false,
  adminSubject,
}) => {
  setImmediate(async () => {
    const tasks = [
      sendEmail(buildAdminNotificationPayload(campaign, adminSubject)),
    ];

    if (includeGamification) {
      tasks.push(
        awardGamificationProgress({
          userId,
          actionKey: "campaign_created",
          sourceKey: `campaign:${campaign._id}:created`,
          sourceType: "campaign",
          sourceId: campaign._id,
          metadata: {
            campaignId: campaign._id?.toString?.() || null,
            title: campaign.title,
            budget: Number(campaign.budget || 0),
            category: campaign.category || null,
          },
        })
      );

      tasks.push(
        evaluateUserBadges(userId, {
          force: true,
          trigger: "campaign_created",
        })
      );
    }

    const taskResults = await Promise.allSettled(tasks);
    taskResults.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          `Campaign side effect ${index + 1} failed for ${campaign._id}:`,
          result.reason
        );
      }
    });
  });
};
