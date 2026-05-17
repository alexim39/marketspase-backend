import { sendEmail } from "../../../../core/email.service.js";
import { NotificationService } from "../../../notification/services/notification.service.js";
import { AdminModel } from "../../../auth/models/index.js";
import { CampaignClickModel, CampaignModel } from "../../../campaign/models/index.js";
import { UserModel } from "../../../user/models/user/index.js";
import { invalidateAuthCacheForUser } from "../../../../shared/middleware/auth.middleware.js";
import { PromotionModel } from "../../models/index.js";
import { PromotionFraudCaseModel } from "../../models/promotion-fraud-case.model.js";
import {
  promotionFraudClearedTemplate,
  promotionFraudSuspensionTemplate,
  promotionFraudWarningTemplate,
} from "./promotion-fraud-email.templates.js";

const OPEN_CASE_STATUSES = ["open", "warning_sent", "final_warning_sent", "suspended"];
const ACTIVE_CASE_FILTER = { $in: OPEN_CASE_STATUSES };
const FRAUD_SUSPENSION_DAYS = Math.max(Number.parseInt(process.env.PROMOTION_FRAUD_SUSPENSION_DAYS || "30", 10) || 30, 1);
const MAX_PROMOTION_BILLABLE_PER_IP_24H = Math.max(Number.parseInt(process.env.PROMOTION_FRAUD_MAX_IP_PROMOTION_24H || "3", 10) || 3, 1);
const MAX_PROMOTION_BILLABLE_PER_IP_UA_6H = Math.max(Number.parseInt(process.env.PROMOTION_FRAUD_MAX_IP_UA_PROMOTION_6H || "2", 10) || 2, 1);
const MAX_PROMOTER_BILLABLE_PER_IP_24H = Math.max(Number.parseInt(process.env.PROMOTION_FRAUD_MAX_IP_PROMOTER_24H || "6", 10) || 6, 1);
const MAX_PROMOTERS_PER_IP_24H = Math.max(Number.parseInt(process.env.PROMOTION_FRAUD_MAX_DISTINCT_PROMOTERS_PER_IP_24H || "3", 10) || 3, 1);
const BILLABLE_BURST_LIMIT_10M = Math.max(Number.parseInt(process.env.PROMOTION_FRAUD_BURST_LIMIT_10M || "4", 10) || 4, 1);
const FRAUD_BLOCK_SCORE = Math.max(Number.parseInt(process.env.PROMOTION_FRAUD_BLOCK_SCORE || "60", 10) || 60, 20);

const BOT_USER_AGENT_PATTERN = /(bot|crawler|spider|headless|phantom|selenium|playwright|curl|wget|python|axios|httpclient|apachebench|postmanruntime)/i;
const SUSPICIOUS_SOURCE_PATTERN = /(autosurf|exchange|traffic|incentive|reward|bonus|clickfarm|spam|bot)/i;

const buildPromotionActionUrl = (promotionId) =>
  `https://marketspase.com/dashboard/campaigns/promotions/${promotionId}`;

const formatDateTime = (value) => {
  try {
    return new Date(value).toLocaleString("en-NG", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value || "");
  }
};

const uniqStrings = (values = []) => Array.from(new Set(
  values
    .flat()
    .map((value) => String(value || "").trim())
    .filter(Boolean)
));

const pushReason = (bucket, code, label, score, details = "") => {
  bucket.push({ code, label, score, details: details || "" });
};

const toRiskLevel = (score) => {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
};

const buildReasonSummary = (reasons = []) =>
  reasons
    .map((reason) => reason.label)
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");

const mergeReasonEntries = (existing = [], incoming = []) => {
  const merged = new Map();

  for (const reason of [...existing, ...incoming]) {
    if (!reason?.code) continue;
    const previous = merged.get(reason.code);
    if (!previous || Number(reason.score || 0) > Number(previous.score || 0)) {
      merged.set(reason.code, {
        code: reason.code,
        label: reason.label || previous?.label || reason.code,
        score: Number(reason.score || 0),
        details: reason.details || previous?.details || "",
      });
    }
  }

  return Array.from(merged.values()).sort((left, right) => Number(right.score || 0) - Number(left.score || 0));
};

const appendPromotionActivity = async (promotionId, action, details, performedBy = null) => {
  await PromotionModel.updateOne(
    { _id: promotionId },
    {
      $push: {
        activityLog: {
          action,
          details,
          timestamp: new Date(),
          performedBy,
        },
      },
    }
  );
};

const appendUserActivity = async (userId, description, metadata = {}) => {
  await UserModel.updateOne(
    { _id: userId },
    {
      $push: {
        activityLog: {
          $each: [{
            action: "account_suspend",
            description,
            resourceType: "promotion",
            resourceId: metadata.promotionId || undefined,
            metadata,
            timestamp: new Date(),
          }],
          $position: 0,
          $slice: 1000,
        },
      },
    }
  );
};

const buildSuspensionWindow = () => {
  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + (FRAUD_SUSPENSION_DAYS * 24 * 60 * 60 * 1000));
  return { startedAt, endsAt };
};

const updatePromoterTrust = (promoterDoc, penalty, riskLevel, caseId, now) => {
  const currentProfile = promoterDoc.fraudProfile || {};
  promoterDoc.fraudProfile = {
    ...currentProfile,
    trustScore: Math.max(0, Math.min(100, Number(currentProfile.trustScore ?? 100) - penalty)),
    riskLevel,
    lastFlaggedAt: now,
    latestCase: caseId,
  };
};

const getAdminSummaryTitle = (status) => {
  if (status === "suspended") return "Suspended promoter account";
  if (status === "final_warning_sent") return "Final warning sent";
  if (status === "warning_sent") return "Promotion fraud warning sent";
  return "Promotion fraud case opened";
};

export const evaluatePromotionClickFraud = async ({
  promotion,
  campaign,
  promoter,
  ipHash,
  userAgentHash,
  userAgent,
  referrer,
  source,
  now = new Date(),
}) => {
  const reasons = [];
  const last24Hours = new Date(now.getTime() - (24 * 60 * 60 * 1000));
  const last6Hours = new Date(now.getTime() - (6 * 60 * 60 * 1000));
  const last10Minutes = new Date(now.getTime() - (10 * 60 * 1000));

  const [
    promotionIp24h,
    promotionIpUa6h,
    promoterIp24h,
    burst10m,
    crossPromoterIds,
    recentPromotionClicks,
  ] = await Promise.all([
    CampaignClickModel.countDocuments({
      promotion: promotion._id,
      chargeStatus: "charged",
      ipHash,
      clickedAt: { $gte: last24Hours },
    }),
    CampaignClickModel.countDocuments({
      promotion: promotion._id,
      chargeStatus: "charged",
      ipHash,
      userAgentHash,
      clickedAt: { $gte: last6Hours },
    }),
    CampaignClickModel.countDocuments({
      promoter: promoter._id,
      chargeStatus: "charged",
      ipHash,
      clickedAt: { $gte: last24Hours },
    }),
    CampaignClickModel.countDocuments({
      promotion: promotion._id,
      chargeStatus: "charged",
      clickedAt: { $gte: last10Minutes },
    }),
    CampaignClickModel.distinct("promoter", {
      chargeStatus: "charged",
      ipHash,
      clickedAt: { $gte: last24Hours },
    }),
    CampaignClickModel.find({
      promotion: promotion._id,
      clickedAt: { $gte: last24Hours },
    })
      .select("status")
      .sort({ clickedAt: -1 })
      .limit(40)
      .lean(),
  ]);

  const promoterFingerprintMatched = Boolean(
    promoter?.securityProfile?.lastAuthIpHash
    && promoter.securityProfile.lastAuthIpHash === ipHash
    && promoter?.securityProfile?.lastAuthUserAgentHash
    && promoter.securityProfile.lastAuthUserAgentHash === userAgentHash
  );

  if (BOT_USER_AGENT_PATTERN.test(String(userAgent || ""))) {
    pushReason(
      reasons,
      "bot_user_agent",
      "Request matched a known automation user-agent",
      100,
      `User agent: ${String(userAgent || "").slice(0, 120)}`
    );
  }

  if (promoterFingerprintMatched) {
    pushReason(
      reasons,
      "self_click_match",
      "Click matched the promoter's recent authentication fingerprint",
      90,
      "The IP and browser signature matched the promoter's recent authenticated session."
    );
  } else if (promoter?.securityProfile?.lastAuthIpHash && promoter.securityProfile.lastAuthIpHash === ipHash) {
    pushReason(
      reasons,
      "shared_auth_ip",
      "Click matched the promoter's recent authenticated IP",
      55,
      "The click IP matched the promoter's recent authenticated IP."
    );
  }

  if (promotionIp24h >= MAX_PROMOTION_BILLABLE_PER_IP_24H) {
    pushReason(
      reasons,
      "ip_repeat_promotion",
      "Too many billable clicks from one IP on the same promotion",
      35,
      `${promotionIp24h} billable clicks were seen from this IP in the last 24 hours.`
    );
  }

  if (promotionIpUa6h >= MAX_PROMOTION_BILLABLE_PER_IP_UA_6H) {
    pushReason(
      reasons,
      "ip_ua_repeat_promotion",
      "Too many billable clicks from one browser signature on the same promotion",
      45,
      `${promotionIpUa6h} billable clicks were seen from the same IP and browser in the last 6 hours.`
    );
  }

  if (promoterIp24h >= MAX_PROMOTER_BILLABLE_PER_IP_24H) {
    pushReason(
      reasons,
      "ip_repeat_promoter",
      "One IP generated too many paid clicks for this promoter",
      30,
      `${promoterIp24h} billable clicks were seen from this IP across the promoter's links in the last 24 hours.`
    );
  }

  if (burst10m >= BILLABLE_BURST_LIMIT_10M) {
    pushReason(
      reasons,
      "burst_pattern",
      "Click burst exceeded the allowed rate for one promotion",
      35,
      `${burst10m} charged clicks were recorded on the promotion in the last 10 minutes.`
    );
  }

  if (Array.isArray(crossPromoterIds) && crossPromoterIds.length >= MAX_PROMOTERS_PER_IP_24H) {
    pushReason(
      reasons,
      "shared_ip_network",
      "One IP is being reused across multiple promoters",
      25,
      `${crossPromoterIds.length} promoters shared the same IP footprint in the last 24 hours.`
    );
  }

  if (SUSPICIOUS_SOURCE_PATTERN.test(String(source || ""))) {
    pushReason(
      reasons,
      "suspicious_source",
      "Traffic source looks like incentivized or exchange traffic",
      40,
      `Source marker: ${String(source || "").slice(0, 80)}`
    );
  }

  const recentClickStatuses = Array.isArray(recentPromotionClicks) ? recentPromotionClicks : [];
  if (recentClickStatuses.length >= 10) {
    const duplicateOrInvalidCount = recentClickStatuses.filter(
      (item) => item.status === "duplicate" || item.status === "invalid"
    ).length;
    const duplicateInvalidRatio = duplicateOrInvalidCount / recentClickStatuses.length;

    if (duplicateInvalidRatio >= 0.65) {
      pushReason(
        reasons,
        "poor_quality_pattern",
        "Recent click quality on this promotion is abnormally poor",
        25,
        `${Math.round(duplicateInvalidRatio * 100)}% of recent clicks were invalid or duplicate.`
      );
    }
  }

  if (!referrer && !source && reasons.length > 0) {
    pushReason(
      reasons,
      "direct_low_context",
      "Suspicious click arrived without referrer or source context",
      10,
      "The click had no referrer and no source marker."
    );
  }

  const riskScore = reasons.reduce((sum, reason) => sum + Number(reason.score || 0), 0);
  const riskLevel = toRiskLevel(riskScore);

  return {
    shouldBlock: riskScore >= FRAUD_BLOCK_SCORE,
    riskScore,
    riskLevel,
    reasons,
    evidence: {
      firstDetectedAt: now,
      lastDetectedAt: now,
      lastClickAt: now,
      totalObservedClicks: recentClickStatuses.length,
      billableObservedClicks: recentClickStatuses.filter((item) => item.status === "billable").length,
      duplicateObservedClicks: recentClickStatuses.filter((item) => item.status === "duplicate").length,
      invalidObservedClicks: recentClickStatuses.filter((item) => item.status === "invalid").length,
      ipHashes: [ipHash],
      userAgentHashes: [userAgentHash],
      referrers: referrer ? [referrer] : [],
      sources: source ? [source] : [],
      matchedPromoterFingerprint: promoterFingerprintMatched,
      notes: `Promotion ${promotion._id} on campaign ${campaign._id} triggered automated fraud checks.`,
    },
  };
};

const sendPromoterFraudWarning = async ({ promoter, promotion, campaign, action, reasonSummary, suspendedUntil }) => {
  const actionUrl = buildPromotionActionUrl(promotion._id);

  try {
    await NotificationService.createNotification({
      recipient: promoter._id,
      type: "system_announcement",
      title: action === "suspend" ? "Promoter account suspended" : "Promotion link paused",
      message: action === "suspend"
        ? `Your promoter account has been suspended for suspicious promotion traffic. Suspension ends ${formatDateTime(suspendedUntil)}.`
        : `We paused your promotion link for "${campaign.title}" after suspicious traffic was detected.`,
      data: {
        promotionId: promotion._id,
        campaignId: campaign._id,
        actionUrl,
        metadata: {
          kind: action === "suspend" ? "promotion_fraud_suspension" : "promotion_fraud_warning",
          reasonSummary,
          suspendedUntil: suspendedUntil || null,
        },
      },
      priority: "high",
    });
  } catch (error) {
    console.error("Unable to send in-app fraud notification:", error.message);
  }

  if (!promoter.email) {
    return;
  }

  try {
    const subject = action === "suspend"
      ? "MarketSpase promoter suspension notice"
      : "MarketSpase promotion warning";
    const html = action === "suspend"
      ? promotionFraudSuspensionTemplate({
          promoterName: promoter.displayName,
          campaignTitle: campaign.title,
          reasonSummary,
          suspendedUntil: formatDateTime(suspendedUntil),
          promotionUrl: actionUrl,
        })
      : promotionFraudWarningTemplate({
          promoterName: promoter.displayName,
          campaignTitle: campaign.title,
          reasonSummary,
          promotionUrl: actionUrl,
        });

    await sendEmail(promoter.email, subject, html);
  } catch (error) {
    console.error("Unable to send promoter fraud email:", error.message);
  }
};

const sendPromoterFraudClearedMessage = async ({ promoter, promotion, campaign }) => {
  const actionUrl = buildPromotionActionUrl(promotion._id);

  try {
    await NotificationService.createNotification({
      recipient: promoter._id,
      type: "system_announcement",
      title: "Promotion access restored",
      message: `Your promotion for "${campaign.title}" has been restored after review.`,
      data: {
        promotionId: promotion._id,
        campaignId: campaign._id,
        actionUrl,
        metadata: { kind: "promotion_fraud_cleared" },
      },
      priority: "medium",
    });
  } catch (error) {
    console.error("Unable to send promoter clearance notification:", error.message);
  }

  if (!promoter.email) {
    return;
  }

  try {
    await sendEmail(
      promoter.email,
      "MarketSpase promotion restored",
      promotionFraudClearedTemplate({
        promoterName: promoter.displayName,
        campaignTitle: campaign.title,
        promotionUrl: actionUrl,
      })
    );
  } catch (error) {
    console.error("Unable to send promoter clearance email:", error.message);
  }
};

const getOpenCaseCount = async (promoterId) =>
  PromotionFraudCaseModel.countDocuments({
    promoter: promoterId,
    status: ACTIVE_CASE_FILTER,
  });

const updatePromotionFraudState = async ({
  promotion,
  caseId,
  riskLevel,
  reasonSummary,
  reasons,
  reviewStatus,
  now,
}) => {
  promotion.isActive = false;
  promotion.fraudStatus = {
    ...(promotion.fraudStatus || {}),
    isFlagged: true,
    reviewStatus,
    riskLevel,
    reasonSummary,
    reasons: uniqStrings([promotion.fraudStatus?.reasons || [], reasons.map((item) => item.code)]),
    warningCount: Number(promotion.fraudStatus?.warningCount || 0) + 1,
    firstFlaggedAt: promotion.fraudStatus?.firstFlaggedAt || now,
    lastFlaggedAt: now,
    blockedAt: now,
    lastCaseId: caseId,
  };
  await promotion.save();
};

const suspendPromoterAndLinks = async ({
  promoter,
  caseId,
  reasonSummary,
  adminId = null,
  now,
}) => {
  const { startedAt, endsAt } = buildSuspensionWindow();

  promoter.isActive = false;
  updatePromoterTrust(promoter, 40, "critical", caseId, now);
  promoter.fraudProfile.warningCount = Number(promoter.fraudProfile?.warningCount || 0) + 1;
  promoter.fraudProfile.strikeCount = Number(promoter.fraudProfile?.strikeCount || 0) + 1;
  promoter.fraudProfile.lastFinalWarningAt = now;
  promoter.fraudProfile.suspendedUntil = endsAt;
  promoter.fraudProfile.suspensionReason = reasonSummary;
  promoter.fraudProfile.suspensionHistory = [
    ...(Array.isArray(promoter.fraudProfile?.suspensionHistory) ? promoter.fraudProfile.suspensionHistory : []),
    {
      startedAt,
      endsAt,
      reason: reasonSummary,
      caseId,
      performedBy: adminId,
    },
  ];
  await promoter.save();

  await PromotionModel.updateMany(
    { promoter: promoter._id, isActive: true },
    {
      $set: {
        isActive: false,
        "fraudStatus.isFlagged": true,
        "fraudStatus.reviewStatus": "blocked",
        "fraudStatus.riskLevel": "critical",
        "fraudStatus.reasonSummary": "Promoter account suspended after repeated suspicious traffic.",
        "fraudStatus.lastFlaggedAt": now,
        "fraudStatus.blockedAt": now,
        "fraudStatus.lastCaseId": caseId,
      },
      $addToSet: {
        "fraudStatus.reasons": "promoter_suspended",
      },
    }
  );

  invalidateAuthCacheForUser(String(promoter._id));
  return endsAt;
};

export const enforcePromotionFraudSignal = async ({
  promotionId,
  promoterId,
  campaignId,
  marketerId,
  reasons = [],
  evidence = {},
  riskScore = 0,
  riskLevel = "medium",
  adminId = null,
  manualAction = null,
}) => {
  const now = new Date();
  const [promotion, promoter, campaign, marketer] = await Promise.all([
    PromotionModel.findById(promotionId),
    UserModel.findById(promoterId),
    CampaignModel.findById(campaignId).select("title owner"),
    UserModel.findById(marketerId).select("displayName email"),
  ]);

  if (!promotion || !promoter || !campaign || !marketer) {
    return null;
  }

  const existingCase = await PromotionFraudCaseModel.findOne({
    promotion: promotion._id,
    promoter: promoter._id,
    status: ACTIVE_CASE_FILTER,
  });

  const mergedReasons = mergeReasonEntries(existingCase?.reasons || [], reasons);
  const reasonSummary = buildReasonSummary(mergedReasons) || "Suspicious promotion traffic was detected.";
  const shouldSuspend = manualAction === "suspend"
    || ((Number(promoter.fraudProfile?.warningCount || 0) >= 1) && !manualAction);
  const action = shouldSuspend ? "suspend" : "warn";
  const nextStatus = action === "suspend" ? "suspended" : "warning_sent";
  const nextRiskLevel = action === "suspend" ? "critical" : riskLevel;
  const detectionTypes = uniqStrings([
    existingCase?.detectionTypes || [],
    mergedReasons.map((reason) => reason.code),
  ]);

  const fraudCase = existingCase || new PromotionFraudCaseModel({
    promoter: promoter._id,
    marketer: marketerId,
    promotion: promotion._id,
    campaign: campaign._id,
  });

  const mergedEvidence = {
    clickIds: existingCase?.evidence?.clickIds || [],
    ipHashes: uniqStrings([existingCase?.evidence?.ipHashes || [], evidence.ipHashes || []]),
    userAgentHashes: uniqStrings([existingCase?.evidence?.userAgentHashes || [], evidence.userAgentHashes || []]),
    referrers: uniqStrings([existingCase?.evidence?.referrers || [], evidence.referrers || []]),
    sources: uniqStrings([existingCase?.evidence?.sources || [], evidence.sources || []]),
    firstDetectedAt: existingCase?.evidence?.firstDetectedAt || evidence.firstDetectedAt || now,
    lastDetectedAt: now,
    lastClickAt: evidence.lastClickAt || now,
    totalObservedClicks: Math.max(Number(existingCase?.evidence?.totalObservedClicks || 0), Number(evidence.totalObservedClicks || 0)),
    billableObservedClicks: Math.max(Number(existingCase?.evidence?.billableObservedClicks || 0), Number(evidence.billableObservedClicks || 0)),
    duplicateObservedClicks: Math.max(Number(existingCase?.evidence?.duplicateObservedClicks || 0), Number(evidence.duplicateObservedClicks || 0)),
    invalidObservedClicks: Math.max(Number(existingCase?.evidence?.invalidObservedClicks || 0), Number(evidence.invalidObservedClicks || 0)),
    matchedPromoterFingerprint: Boolean(existingCase?.evidence?.matchedPromoterFingerprint || evidence.matchedPromoterFingerprint),
    notes: reasonSummary,
  };

  fraudCase.status = nextStatus;
  fraudCase.riskScore = Math.max(Number(existingCase?.riskScore || 0), Number(riskScore || 0));
  fraudCase.riskLevel = nextRiskLevel;
  fraudCase.detectionTypes = detectionTypes;
  fraudCase.reasons = mergedReasons;
  fraudCase.evidence = mergedEvidence;
  fraudCase.actionLog = [
    ...(Array.isArray(fraudCase.actionLog) ? fraudCase.actionLog : []),
    {
      action,
      details: reasonSummary,
      performedByAdmin: adminId,
      timestamp: now,
    },
  ];

  if (action === "suspend") {
    fraudCase.finalWarningSentAt = now;
    fraudCase.suspendedAt = now;
  } else {
    fraudCase.warningSentAt = now;
  }

  await fraudCase.save();

  await updatePromotionFraudState({
    promotion,
    caseId: fraudCase._id,
    riskLevel: nextRiskLevel,
    reasonSummary,
    reasons: mergedReasons,
    reviewStatus: action === "suspend" ? "blocked" : "warning",
    now,
  });

  let suspendedUntil = null;
  if (action === "suspend") {
    suspendedUntil = await suspendPromoterAndLinks({
      promoter,
      caseId: fraudCase._id,
      reasonSummary,
      adminId,
      now,
    });
    fraudCase.suspendedUntil = suspendedUntil;
    await fraudCase.save();
  } else if (!existingCase || existingCase.status === "open") {
    updatePromoterTrust(promoter, 25, nextRiskLevel, fraudCase._id, now);
    promoter.fraudProfile.warningCount = Number(promoter.fraudProfile?.warningCount || 0) + 1;
    promoter.fraudProfile.strikeCount = Number(promoter.fraudProfile?.strikeCount || 0) + 1;
    promoter.fraudProfile.lastWarningAt = now;
    await promoter.save();
  }

  const openCaseCount = await getOpenCaseCount(promoter._id);
  await UserModel.updateOne(
    { _id: promoter._id },
    {
      $set: {
        "fraudProfile.activeCaseCount": openCaseCount,
        "fraudProfile.latestCase": fraudCase._id,
      },
    }
  );

  await appendPromotionActivity(
    promotion._id,
    action === "suspend" ? "Promotion Fraud Suspension" : "Promotion Fraud Warning",
    reasonSummary,
    adminId
  );

  await appendUserActivity(
    promoter._id,
    action === "suspend"
      ? "Promoter account suspended after repeated suspicious promotion traffic."
      : "Promotion link paused after suspicious traffic was detected.",
    {
      promotionId: promotion._id,
      caseId: fraudCase._id,
      reasonSummary,
      action,
    }
  );

  await sendPromoterFraudWarning({
    promoter,
    promotion,
    campaign,
    action,
    reasonSummary,
    suspendedUntil,
  });

  return {
    caseId: fraudCase._id,
    action,
    status: fraudCase.status,
    reasonSummary,
    suspendedUntil,
  };
};

export const getPromotionFraudSummary = async () => {
  const [caseStats, blockedPromotions, suspendedPromoters, criticalCases] = await Promise.all([
    PromotionFraudCaseModel.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
    PromotionModel.countDocuments({
      isActive: false,
      "fraudStatus.isFlagged": true,
      "fraudStatus.reviewStatus": { $in: ["warning", "final_warning", "blocked"] },
    }),
    UserModel.countDocuments({
      isActive: false,
      "fraudProfile.suspendedUntil": { $gt: new Date() },
      isDeleted: false,
    }),
    PromotionFraudCaseModel.countDocuments({
      status: ACTIVE_CASE_FILTER,
      riskLevel: "critical",
    }),
  ]);

  const statusCounts = {
    open: 0,
    warning_sent: 0,
    final_warning_sent: 0,
    suspended: 0,
    resolved: 0,
    dismissed: 0,
  };

  for (const row of caseStats) {
    statusCounts[row._id] = row.count;
  }

  const openCases =
    statusCounts.open +
    statusCounts.warning_sent +
    statusCounts.final_warning_sent +
    statusCounts.suspended;

  return {
    openCases,
    blockedPromotions,
    suspendedPromoters,
    criticalCases,
    statusCounts,
  };
};

export const getPromotionFraudCases = async ({
  status,
  riskLevel,
  search,
  page = 1,
  limit = 25,
}) => {
  const pageNum = Math.max(Number.parseInt(page, 10) || 1, 1);
  const limitNum = Math.max(Math.min(Number.parseInt(limit, 10) || 25, 100), 1);
  const skip = (pageNum - 1) * limitNum;
  const filter = {};

  if (status && status !== "all") {
    filter.status = status;
  }

  if (riskLevel && riskLevel !== "all") {
    filter.riskLevel = riskLevel;
  }

  if (search) {
    const searchRegex = new RegExp(String(search).trim(), "i");
    const [promoters, campaigns, promotions] = await Promise.all([
      UserModel.find({
        $or: [
          { displayName: searchRegex },
          { email: searchRegex },
          { username: searchRegex },
        ],
      }).select("_id"),
      CampaignModel.find({ title: searchRegex }).select("_id"),
      PromotionModel.find({ upi: searchRegex }).select("_id"),
    ]);

    filter.$or = [
      { promoter: { $in: promoters.map((item) => item._id) } },
      { campaign: { $in: campaigns.map((item) => item._id) } },
      { promotion: { $in: promotions.map((item) => item._id) } },
      { detectionTypes: searchRegex },
      { "reasons.label": searchRegex },
    ];
  }

  const [cases, total] = await Promise.all([
    PromotionFraudCaseModel.find(filter)
      .populate("promoter", "displayName username email avatar role isActive fraudProfile")
      .populate("campaign", "title status category")
      .populate("promotion", "upi status isActive fraudStatus promotionUrl clickStats")
      .populate("reviewedBy", "name email")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    PromotionFraudCaseModel.countDocuments(filter),
  ]);

  return {
    cases: cases.map((item) => ({
      ...item,
      adminSummaryTitle: getAdminSummaryTitle(item.status),
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

export const applyPromotionFraudCaseAction = async ({
  caseId,
  action,
  reason = "",
  adminId = null,
}) => {
  const fraudCase = await PromotionFraudCaseModel.findById(caseId);
  if (!fraudCase) {
    throw Object.assign(new Error("Fraud case not found"), { status: 404 });
  }

  const [promotion, promoter, campaign] = await Promise.all([
    PromotionModel.findById(fraudCase.promotion),
    UserModel.findById(fraudCase.promoter),
    CampaignModel.findById(fraudCase.campaign).select("title"),
  ]);

  if (!promotion || !promoter || !campaign) {
    throw Object.assign(new Error("Fraud case dependencies could not be loaded"), { status: 404 });
  }

  const now = new Date();

  if (action === "suspend_30_days") {
    return enforcePromotionFraudSignal({
      promotionId: promotion._id,
      promoterId: promoter._id,
      campaignId: campaign._id,
      marketerId: fraudCase.marketer,
      reasons: fraudCase.reasons,
      evidence: fraudCase.evidence,
      riskScore: Math.max(Number(fraudCase.riskScore || 0), 95),
      riskLevel: "critical",
      adminId,
      manualAction: "suspend",
    });
  }

  if (action === "mark_resolved") {
    fraudCase.status = "resolved";
    fraudCase.reviewedAt = now;
    fraudCase.reviewedBy = adminId;
    fraudCase.resolutionNotes = reason || fraudCase.resolutionNotes || "";
    fraudCase.actionLog = [
      ...(Array.isArray(fraudCase.actionLog) ? fraudCase.actionLog : []),
      {
        action: "mark_resolved",
        details: reason || "Fraud case marked resolved by admin.",
        performedByAdmin: adminId,
        timestamp: now,
      },
    ];
    await fraudCase.save();

    const activeCaseCount = await getOpenCaseCount(promoter._id);
    await UserModel.updateOne(
      { _id: promoter._id },
      { $set: { "fraudProfile.activeCaseCount": activeCaseCount } }
    );

    return {
      caseId: fraudCase._id,
      status: fraudCase.status,
    };
  }

  if (action === "dismiss" || action === "reactivate_promotion") {
    promotion.isActive = promoter.isActive !== false;
    promotion.fraudStatus = {
      ...(promotion.fraudStatus || {}),
      isFlagged: false,
      reviewStatus: "resolved",
      riskLevel: "low",
      reasonSummary: "",
      reasons: [],
      lastFlaggedAt: promotion.fraudStatus?.lastFlaggedAt || now,
      warningCount: 0,
      lastCaseId: fraudCase._id,
    };
    await promotion.save();

    fraudCase.status = action === "dismiss" ? "dismissed" : "resolved";
    fraudCase.reviewedAt = now;
    fraudCase.reviewedBy = adminId;
    fraudCase.resolutionNotes = reason || fraudCase.resolutionNotes || "";
    fraudCase.actionLog = [
      ...(Array.isArray(fraudCase.actionLog) ? fraudCase.actionLog : []),
      {
        action,
        details: reason || "Promotion link restored after admin review.",
        performedByAdmin: adminId,
        timestamp: now,
      },
    ];
    await fraudCase.save();

    const activeCaseCount = await getOpenCaseCount(promoter._id);
    await UserModel.updateOne(
      { _id: promoter._id },
      {
        $set: {
          "fraudProfile.activeCaseCount": activeCaseCount,
          "fraudProfile.latestCase": fraudCase._id,
          "fraudProfile.riskLevel": activeCaseCount > 0 ? promoter.fraudProfile?.riskLevel || "medium" : "low",
        },
      }
    );

    await appendPromotionActivity(
      promotion._id,
      "Promotion Fraud Case Cleared",
      reason || "Promotion access restored after admin review.",
      adminId
    );

    await sendPromoterFraudClearedMessage({
      promoter,
      promotion,
      campaign,
    });

    return {
      caseId: fraudCase._id,
      status: fraudCase.status,
      promotionReactivated: promotion.isActive,
    };
  }

  throw Object.assign(new Error("Unsupported fraud action"), { status: 400 });
};

export const getFraudDashboardPulse = async () => {
  const summary = await getPromotionFraudSummary();
  const recentCases = await PromotionFraudCaseModel.find({
    status: ACTIVE_CASE_FILTER,
  })
    .sort({ updatedAt: -1 })
    .limit(5)
    .populate("promoter", "displayName username")
    .populate("campaign", "title")
    .lean();

  return {
    count: summary.openCases,
    recent: recentCases.map((item) => ({
      id: item._id,
      title: item.campaign?.title || "Promotion fraud case",
      promoter: item.promoter?.displayName || item.promoter?.username || "Promoter",
      status: item.status,
      riskLevel: item.riskLevel,
      updatedAt: item.updatedAt,
    })),
  };
};

export const listAdminRecipients = async () =>
  AdminModel.find({ isActive: true, isDeleted: false })
    .select("_id name email role")
    .lean();
