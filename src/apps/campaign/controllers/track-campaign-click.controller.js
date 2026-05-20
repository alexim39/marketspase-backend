import crypto from "crypto";
import mongoose from "mongoose";
import { CampaignClickModel, CampaignModel } from "../models/index.js";
import { PromotionModel } from "../../promotion/models/index.js";
import { UserModel } from "../../user/models/user/index.js";
import {
  enforcePromotionFraudSignal,
  evaluatePromotionClickFraud,
  isPromotionFraudLinkRestoreDue,
  restorePromotionLinkAfterFraudHold,
} from "../../promotion/services/fraud/promotion-fraud.service.js";
import {
  hasValidCampaignCostPerClick,
  resolveCampaignCostPerClick,
} from "../services/campaign-pricing.service.js";
import {
  buildCampaignUnavailableUrl,
  deactivateCampaignPromotions,
} from "../services/campaign-runtime.service.js";

const MAX_TX_RETRIES = 5;
const DEDUPE_WINDOW_MINUTES = Number(process.env.PPC_CLICK_DEDUPE_WINDOW_MINUTES ?? 30);
const HASH_SALT = process.env.CLICK_TRACKING_HASH_SALT || process.env.JWTTOKENSECRET || "marketspase-click";

const isRetryableTxnError = (err) =>
  err?.errorLabels?.includes("TransientTransactionError") ||
  err?.errorLabels?.includes("UnknownTransactionCommitResult") ||
  /Write conflict/i.test(err?.message ?? "");

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const hashValue = (value = "") =>
  crypto
    .createHash("sha256")
    .update(`${HASH_SALT}:${value}`)
    .digest("hex");

const getClientIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "";
};

const getDeviceType = (userAgent = "") => {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobile|iphone|android/.test(ua)) return "mobile";
  if (ua) return "desktop";
  return "unknown";
};

const normalizeDestinationUrl = (url) => {
  const fallback = process.env.FRONTEND_URL || "https://marketspase.com";
  if (!url || typeof url !== "string") return fallback;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${fallback.replace(/\/$/, "")}${url}`;
  return `https://${url}`;
};

const buildWhatsAppDestinationUrl = (user) => {
  const phone =
    user?.personalInfo?.phone ||
    user?.personalInfo?.phoneDetails?.fullNumber ||
    user?.personalInfo?.phoneDetails?.nationalNumber;

  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return process.env.FRONTEND_URL || "https://marketspase.com";

  const message = "Hi, I'm reaching out from MarketSpase. I'm interested in your offer and would like to know more!";
  const encodedMessage = encodeURIComponent(message);

  const baseUrl = process.env.WHATSAPP_CHAT_BASE_URL || "https://wa.me";
  
  return `${baseUrl.replace(/\/$/, "")}/${digits}?text=${encodedMessage}`;
};

const getDestinationUrl = (promotion, campaign, marketer) => {
  const rawDestination = promotion.destinationUrl || campaign.link || buildWhatsAppDestinationUrl(marketer);
  return normalizeDestinationUrl(rawDestination);
};

const getRemainingBudgetExpression = () => ({
  $subtract: ["$budget", { $ifNull: ["$spentBudget", 0] }],
});

const getCostPerClick = (promotion, campaign) =>
  resolveCampaignCostPerClick(
    promotion?.costPerClick,
    campaign?.costPerClick,
    campaign?.payoutPerPromotion
  );

const buildClickKeys = ({ promotionId, ipHash, userAgentHash, clickedAt }) => {
  const windowMs = Math.max(DEDUPE_WINDOW_MINUTES, 1) * 60 * 1000;
  const bucket = Math.floor(clickedAt.getTime() / windowMs);
  const dedupeKey = `${promotionId}:${ipHash}:${userAgentHash}:${bucket}`;
  return {
    dedupeKey,
    billableKey: dedupeKey,
  };
};

const createClickAudit = async ({ session, click }) => {
  const [created] = await CampaignClickModel.create([click], { session });
  return created;
};

const incrementNonBillableCounters = async ({ session, campaignId, promotionId, status, now }) => {
  const campaignInc = { totalClicks: 1 };
  const promotionInc = { "clickStats.totalClicks": 1 };

  if (status === "duplicate") {
    campaignInc.duplicateClicks = 1;
    promotionInc["clickStats.duplicateClicks"] = 1;
  } else {
    campaignInc.invalidClicks = 1;
    promotionInc["clickStats.invalidClicks"] = 1;
  }

  await Promise.all([
    CampaignModel.updateOne(
      { _id: campaignId },
      {
        $inc: campaignInc,
        $set: { lastClickAt: now },
      },
      { session }
    ),
    PromotionModel.updateOne(
      { _id: promotionId },
      {
        $inc: promotionInc,
        $set: { "clickStats.lastClickAt": now },
      },
      { session }
    ),
  ]);
};

const maybeExhaustCampaign = async ({ session, campaignId, costPerClick, now }) => {
  const exhausted = await CampaignModel.updateOne(
    {
      _id: campaignId,
      status: "active",
      $expr: {
        $lt: [getRemainingBudgetExpression(), costPerClick],
      },
    },
    {
      $set: {
        status: "exhausted",
        exhaustedAt: now,
      },
      $push: {
        activityLog: {
          action: "Campaign Exhausted",
          details: "Campaign budget is below the cost of one more click.",
          timestamp: now,
        },
      },
    },
    { session }
  );

  if (exhausted.modifiedCount) {
    await deactivateCampaignPromotions({ campaignId, session });
  }

  return Boolean(exhausted.modifiedCount);
};

const sendTrackingResponse = (req, res, result) => {
  if (req.query.redirect === "false") {
    return res.status(result.httpStatus ?? 200).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  }

  if (result.redirectUrl) {
    return res.redirect(result.redirectUrl);
  }

  return res.status(result.httpStatus ?? 410).json({
    success: result.success,
    message: result.message,
  });
};

const recordDuplicateAfterUniqueCollision = async ({
  upi,
  now,
  ipHash,
  userAgentHash,
  referrer,
  source,
  deviceType,
}) => {
  const promotion = await PromotionModel.findOne({ upi })
    .select("_id campaign promoter upi destinationUrl costPerClick");

  if (!promotion) return null;

  const campaign = await CampaignModel.findById(promotion.campaign)
    .select("_id owner link costPerClick payoutPerPromotion currency");

  if (!campaign) return null;

  const marketer = await UserModel.findById(campaign.owner)
    .select("personalInfo.phone personalInfo.phoneDetails");

  const costPerClick = getCostPerClick(promotion, campaign);
  const destinationUrl = getDestinationUrl(promotion, campaign, marketer);
  const { dedupeKey } = buildClickKeys({
    promotionId: promotion._id,
    ipHash,
    userAgentHash,
    clickedAt: now,
  });

  const click = await CampaignClickModel.create({
    campaign: campaign._id,
    promotion: promotion._id,
    promoter: promotion.promoter,
    marketer: campaign.owner,
    upi,
    clickedAt: now,
    unitCost: costPerClick,
    cost: 0,
    currency: campaign.currency || "NGN",
    status: "duplicate",
    chargeStatus: "not_charged",
    destinationUrl,
    referrer,
    source,
    ipHash,
    userAgentHash,
    deviceType,
    dedupeKey,
    metadata: { reason: "dedupe_window_race" },
  });

  await Promise.all([
    CampaignModel.updateOne(
      { _id: campaign._id },
      {
        $inc: { totalClicks: 1, duplicateClicks: 1 },
        $set: { lastClickAt: now },
      }
    ),
    PromotionModel.updateOne(
      { _id: promotion._id },
      {
        $inc: {
          "clickStats.totalClicks": 1,
          "clickStats.duplicateClicks": 1,
        },
        $set: { "clickStats.lastClickAt": now },
      }
    ),
  ]);

  return {
    success: true,
    message: "Duplicate click recorded without charge",
    redirectUrl: destinationUrl,
    data: { clickId: click._id, status: "duplicate", charged: false },
  };
};

export const trackCampaignClick = async (req, res) => {
  const { upi } = req.params;
  const now = new Date();
  const userAgent = req.headers["user-agent"] || "";
  const redirectMode = String(req.query.redirect || "").toLowerCase();
  const isRedirectBypassed = redirectMode === "false";
  const ipHash = hashValue(getClientIp(req));
  const userAgentHash = hashValue(userAgent);
  const referrer = req.get("referer") || req.get("referrer") || "";
  const source = req.query.source || req.query.utm_source || "";
  const deviceType = getDeviceType(userAgent);

  for (let attempt = 1; attempt <= MAX_TX_RETRIES; attempt++) {
    const session = await mongoose.startSession();
    let txResult = null;

    try {
      await session.withTransaction(async () => {
        const promotion = await PromotionModel.findOne({ upi })
          .session(session)
          .select(`
            _id campaign promoter upi promotionUrl destinationUrl
            status isActive payoutModel costPerClick clickStats payoutAmount fraudStatus
          `);

        if (!promotion) {
          txResult = {
            success: false,
            httpStatus: 410,
            message: "Campaign is no longer available",
            redirectUrl: buildCampaignUnavailableUrl({ reason: "invalid_link" }),
            data: { status: "invalid" },
          };
          return;
        }

        const campaign = await CampaignModel.findById(promotion.campaign)
          .session(session)
          .select(`
            _id title owner status link budget spentBudget reservedBudget
            costPerClick payoutPerPromotion currency
          `);

        if (!campaign) {
          txResult = {
            success: false,
            httpStatus: 410,
            message: "Campaign is no longer available",
            redirectUrl: buildCampaignUnavailableUrl({ reason: "campaign_removed" }),
            data: { status: "invalid" },
          };
          return;
        }

        const marketer = await UserModel.findById(campaign.owner)
          .session(session)
          .select("displayName personalInfo.phone personalInfo.phoneDetails");

        const promoter = await UserModel.findById(promotion.promoter)
          .session(session)
          .select("displayName email isActive fraudProfile securityProfile");

        if (!marketer || !promoter) {
          txResult = {
            success: false,
            httpStatus: 410,
            message: "Campaign is no longer available",
            redirectUrl: buildCampaignUnavailableUrl({
              campaign,
              reason: "campaign_removed",
            }),
            data: { status: "invalid" },
          };
          return;
        }

        if (isPromotionFraudLinkRestoreDue(promotion, now)) {
          const restoreResult = await restorePromotionLinkAfterFraudHold({
            promotion,
            now,
            session,
            source: "tracking link revisit after fraud hold elapsed",
          });

          if (restoreResult.restored) {
            promotion.isActive = Boolean(restoreResult.reactivated);
            promotion.fraudStatus = {
              ...(promotion.fraudStatus?.toObject?.() || promotion.fraudStatus || {}),
              blockedUntil: null,
              autoRestoredAt: now,
            };
          }
        }

        const costPerClick = getCostPerClick(promotion, campaign);
        const destinationUrl = getDestinationUrl(promotion, campaign, marketer);

        if (!hasValidCampaignCostPerClick(promotion.costPerClick)) {
          promotion.costPerClick = costPerClick;
          promotion.markModified("costPerClick");
          await promotion.save({ session });
        }

        if (!hasValidCampaignCostPerClick(campaign.costPerClick)) {
          campaign.costPerClick = costPerClick;
          campaign.payoutModel = "pay_per_click";
          campaign.markModified("costPerClick");
          await campaign.save({ session });
        }

        const { dedupeKey, billableKey } = buildClickKeys({
          promotionId: promotion._id,
          ipHash,
          userAgentHash,
          clickedAt: now,
        });

        const baseClick = {
          campaign: campaign._id,
          promotion: promotion._id,
          promoter: promotion.promoter,
          marketer: campaign.owner,
          upi,
          clickedAt: now,
          unitCost: costPerClick,
          currency: campaign.currency || "NGN",
          destinationUrl,
          referrer,
          source,
          ipHash,
          userAgentHash,
          deviceType,
          dedupeKey,
        };

        const fraudSignal = await evaluatePromotionClickFraud({
          promotion,
          campaign,
          promoter,
          ipHash,
          userAgentHash,
          userAgent,
          referrer,
          source,
          now,
        });

        if (isRedirectBypassed) {
          fraudSignal.reasons = [
            ...fraudSignal.reasons,
            {
              code: "redirect_bypass_probe",
              label: "Tracking link was probed without completing redirect",
              score: 80,
              details: "The request used redirect=false, which is treated as a scripted or automated probe.",
            },
          ];
          fraudSignal.riskScore += 80;
          fraudSignal.riskLevel = "critical";
          fraudSignal.shouldBlock = true;
          fraudSignal.evidence = {
            ...(fraudSignal.evidence || {}),
            notes: "redirect=false was used on the tracking endpoint.",
          };
        }

        if (campaign.status !== "active" || promotion.isActive === false || promoter.isActive === false) {
          const click = await createClickAudit({
            session,
            click: {
              ...baseClick,
              cost: 0,
              status: campaign.status === "exhausted" ? "exhausted" : "invalid",
              chargeStatus: "not_charged",
              metadata: {
                reason: promoter.isActive === false
                  ? "promoter_account_suspended"
                  : "campaign_or_promotion_inactive",
              },
            },
          });

          await incrementNonBillableCounters({
            session,
            campaignId: campaign._id,
            promotionId: promotion._id,
            status: click.status,
            now,
          });

          txResult = {
            success: false,
            httpStatus: promoter.isActive === false ? 403 : 410,
            message: promoter.isActive === false
              ? "Promotion is temporarily unavailable"
              : "Campaign is no longer active",
            redirectUrl: buildCampaignUnavailableUrl({
              campaign,
              marketer,
              reason: promoter.isActive === false
                ? "promoter_suspended"
                : campaign.status === "exhausted"
                  ? "exhausted"
                  : String(campaign.status || "inactive"),
            }),
            data: { clickId: click._id, status: click.status },
          };
          return;
        }

        if (fraudSignal.shouldBlock) {
          const click = await createClickAudit({
            session,
            click: {
              ...baseClick,
              cost: 0,
              status: "invalid",
              chargeStatus: "not_charged",
              metadata: {
                reason: "promotion_fraud_signal",
                riskScore: fraudSignal.riskScore,
                riskLevel: fraudSignal.riskLevel,
                reasons: fraudSignal.reasons.map((item) => ({
                  code: item.code,
                  label: item.label,
                })),
              },
            },
          });

          await incrementNonBillableCounters({
            session,
            campaignId: campaign._id,
            promotionId: promotion._id,
            status: "invalid",
            now,
          });

          txResult = {
            success: false,
            httpStatus: 403,
            message: "Promotion link is temporarily unavailable",
            redirectUrl: buildCampaignUnavailableUrl({
              campaign,
              marketer,
              reason: "under_review",
            }),
            data: {
              clickId: click._id,
              status: "invalid",
              charged: false,
            },
            fraudEnforcement: {
              promotionId: promotion._id,
              promoterId: promotion.promoter,
              campaignId: campaign._id,
              marketerId: campaign.owner,
              reasons: fraudSignal.reasons,
              evidence: {
                ...(fraudSignal.evidence || {}),
                clickIds: [click._id],
              },
              riskScore: fraudSignal.riskScore,
              riskLevel: fraudSignal.riskLevel,
            },
          };
          return;
        }

        const duplicate = await CampaignClickModel.exists({ billableKey }).session(session);
        if (duplicate) {
          const click = await createClickAudit({
            session,
            click: {
              ...baseClick,
              cost: 0,
              status: "duplicate",
              chargeStatus: "not_charged",
              metadata: { reason: "dedupe_window" },
            },
          });

          await incrementNonBillableCounters({
            session,
            campaignId: campaign._id,
            promotionId: promotion._id,
            status: "duplicate",
            now,
          });

          txResult = {
            success: true,
            message: "Duplicate click recorded without charge",
            redirectUrl: destinationUrl,
            data: { clickId: click._id, status: "duplicate", charged: false },
          };
          return;
        }

        const walletDebit = await UserModel.updateOne(
          {
            _id: campaign.owner,
            "wallets.marketer.balance": { $gte: costPerClick },
          },
          {
            $inc: { "wallets.marketer.balance": -costPerClick },
            $push: {
              "wallets.marketer.transactions": {
                $each: [{
                  amount: costPerClick,
                  type: "debit",
                  category: "campaign",
                  description: `PPC click charge for campaign "${campaign.title}"`,
                  relatedCampaign: campaign._id,
                  relatedPromotion: promotion._id,
                  status: "completed",
                  createdAt: now,
                }],
                $position: 0,
                $slice: 500,
              },
            },
          },
          { session }
        );

        if (!walletDebit.modifiedCount) {
          const click = await createClickAudit({
            session,
            click: {
              ...baseClick,
              cost: 0,
              status: "invalid",
              chargeStatus: "not_charged",
              metadata: { reason: "insufficient_marketer_wallet_balance" },
            },
          });

          await incrementNonBillableCounters({
            session,
            campaignId: campaign._id,
            promotionId: promotion._id,
            status: "invalid",
            now,
          });

          await CampaignModel.updateOne(
            { _id: campaign._id, status: "active" },
            {
              $set: { status: "paused" },
              $push: {
                activityLog: {
                  action: "Campaign Paused",
                  details: "Campaign was paused automatically because the marketer wallet balance could not fund the next click.",
                  timestamp: now,
                },
              },
            },
            { session }
          );

          await deactivateCampaignPromotions({ campaignId: campaign._id, session });

          txResult = {
            success: false,
            httpStatus: 402,
            message: "Campaign owner has insufficient wallet balance",
            redirectUrl: buildCampaignUnavailableUrl({
              campaign,
              marketer,
              reason: "paused",
            }),
            data: { clickId: click._id, status: "invalid", charged: false },
          };
          return;
        }

        const campaignCharge = await CampaignModel.updateOne(
          {
            _id: campaign._id,
            status: "active",
            $expr: {
              $gte: [getRemainingBudgetExpression(), costPerClick],
            },
          },
          {
            $inc: {
              spentBudget: costPerClick,
              totalClicks: 1,
              billableClicks: 1,
              totalPayouts: costPerClick,
            },
            $set: {
              lastClickAt: now,
              payoutModel: "pay_per_click",
              costPerClick,
            },
          },
          { session }
        );

        if (!campaignCharge.modifiedCount) {
          await CampaignModel.updateOne(
            { _id: campaign._id, status: "active" },
            {
              $set: { status: "exhausted", exhaustedAt: now },
              $push: {
                activityLog: {
                  action: "Campaign Exhausted",
                  details: "Campaign budget was exhausted before this click could be charged.",
                  timestamp: now,
                },
              },
            },
            { session }
          );

          await deactivateCampaignPromotions({ campaignId: campaign._id, session });

          txResult = {
            success: false,
            httpStatus: 410,
            message: "Campaign budget was exhausted",
            redirectUrl: buildCampaignUnavailableUrl({
              campaign,
              marketer,
              reason: "exhausted",
            }),
            data: { status: "exhausted", charged: false },
          };
          return;
        }

        const click = await createClickAudit({
          session,
          click: {
            ...baseClick,
            cost: costPerClick,
            status: "billable",
            chargeStatus: "charged",
            billableKey,
          },
        });

        await Promise.all([
          PromotionModel.updateOne(
            { _id: promotion._id },
            {
              $inc: {
                payoutAmount: costPerClick,
                "clickStats.totalClicks": 1,
                "clickStats.billableClicks": 1,
                "clickStats.earnedAmount": costPerClick,
              },
              $set: { "clickStats.lastClickAt": now },
            },
            { session }
          ),
          UserModel.updateOne(
            { _id: promotion.promoter },
            {
              $inc: { "wallets.promoter.balance": costPerClick },
              $push: {
                "wallets.promoter.transactions": {
                  $each: [{
                    amount: costPerClick,
                    type: "credit",
                    category: "promotion",
                    description: `PPC earning from campaign "${campaign.title}"`,
                    relatedCampaign: campaign._id,
                    relatedPromotion: promotion._id,
                    status: "completed",
                    createdAt: now,
                  }],
                  $position: 0,
                  $slice: 500,
                },
              },
            },
            { session }
          ),
        ]);

        const exhausted = await maybeExhaustCampaign({
          session,
          campaignId: campaign._id,
          costPerClick,
          now,
        });

        txResult = {
          success: true,
          message: "Click tracked and charged successfully",
          redirectUrl: destinationUrl,
          data: {
            clickId: click._id,
            campaignId: campaign._id,
            promotionId: promotion._id,
            promoterId: promotion.promoter,
            marketerId: campaign.owner,
            cost: costPerClick,
            status: "billable",
            charged: true,
            campaignExhausted: exhausted,
          },
        };
      },
      {
        maxCommitTimeMS: 8000,
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      });

      session.endSession();

      setImmediate(() => {
        const io = req.app.get("io");
        if (!io || !txResult?.data) return;

        if (txResult.data.promoterId) {
          io.to(`user:${txResult.data.promoterId}`).emit("campaign_click_recorded", txResult.data);
        }
        if (txResult.data.marketerId) {
          io.to(`user:${txResult.data.marketerId}`).emit("campaign_click_recorded", txResult.data);
        }
      });

      if (txResult?.fraudEnforcement) {
        setImmediate(() => {
          enforcePromotionFraudSignal(txResult.fraudEnforcement).catch((error) => {
            console.error("Failed to enforce promotion fraud signal:", error.message);
          });
        });
      }

      return sendTrackingResponse(req, res, txResult);
    } catch (err) {
      session.endSession();

      if (err?.code === 11000) {
        const duplicateResult = await recordDuplicateAfterUniqueCollision({
          upi,
          now,
          ipHash,
          userAgentHash,
          referrer,
          source,
          deviceType,
        });

        return sendTrackingResponse(req, res, duplicateResult || {
          success: true,
          message: "Duplicate click recorded without charge",
          redirectUrl: process.env.FRONTEND_URL || "https://marketspase.com",
          data: { status: "duplicate", charged: false },
        });
      }

      if (isRetryableTxnError(err) && attempt < MAX_TX_RETRIES) {
        await delay(50 * 2 ** attempt);
        continue;
      }

      return res.status(err?.status ?? 500).json({
        success: false,
        message: err?.message ?? "Failed to track campaign click",
      });
    }
  }

  return res.status(503).json({
    success: false,
    message: "System busy. Please retry.",
  });
};
