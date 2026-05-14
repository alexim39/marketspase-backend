import crypto from "crypto";
import mongoose from "mongoose";
import { CampaignClickModel, CampaignModel } from "../models/index.js";
import { PromotionModel } from "../../promotion/models/index.js";
import { UserModel } from "../../user/models/user/index.js";

const MAX_TX_RETRIES = 5;
const DEFAULT_COST_PER_CLICK = Number(process.env.DEFAULT_CAMPAIGN_COST_PER_CLICK ?? 80);
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
  const fallback = process.env.CAMPAIGN_UNAVAILABLE_REDIRECT_URL || process.env.FRONTEND_URL || "https://marketspase.com";
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
  $subtract: [
    "$budget",
    {
      $add: [
        { $ifNull: ["$spentBudget", 0] },
        { $ifNull: ["$reservedBudget", 0] },
      ],
    },
  ],
});

const getCostPerClick = (promotion, campaign) => {
  const costPerClick = Number(promotion.costPerClick ?? campaign.costPerClick ?? DEFAULT_COST_PER_CLICK);
  if (!Number.isFinite(costPerClick) || costPerClick <= 0) {
    throw { status: 500, message: "Invalid campaign cost-per-click configuration" };
  }
  return costPerClick;
};

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
    await PromotionModel.updateMany(
      { campaign: campaignId, isActive: true },
      { $set: { isActive: false } },
      { session }
    );
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
    .select("_id owner link costPerClick currency");

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
            status isActive payoutModel costPerClick clickStats payoutAmount
          `);

        if (!promotion) {
          throw { status: 404, message: "Invalid promotion link" };
        }

        const campaign = await CampaignModel.findById(promotion.campaign)
          .session(session)
          .select(`
            _id title owner status link budget spentBudget reservedBudget
            costPerClick currency
          `);

        if (!campaign) {
          throw { status: 404, message: "Campaign not found" };
        }

        const marketer = await UserModel.findById(campaign.owner)
          .session(session)
          .select("personalInfo.phone personalInfo.phoneDetails");

        if (!marketer) {
          throw { status: 404, message: "Campaign owner not found" };
        }

        const costPerClick = getCostPerClick(promotion, campaign);
        const destinationUrl = getDestinationUrl(promotion, campaign, marketer);
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

        if (campaign.status !== "active" || promotion.isActive === false) {
          const click = await createClickAudit({
            session,
            click: {
              ...baseClick,
              cost: 0,
              status: campaign.status === "exhausted" ? "exhausted" : "invalid",
              chargeStatus: "not_charged",
              metadata: { reason: "campaign_or_promotion_inactive" },
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
            httpStatus: 410,
            message: "Campaign is no longer active",
            redirectUrl: process.env.CAMPAIGN_UNAVAILABLE_REDIRECT_URL || process.env.FRONTEND_URL,
            data: { clickId: click._id, status: click.status },
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

          txResult = {
            success: false,
            httpStatus: 402,
            message: "Campaign owner has insufficient wallet balance",
            redirectUrl: process.env.CAMPAIGN_UNAVAILABLE_REDIRECT_URL || process.env.FRONTEND_URL,
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
          throw {
            status: 409,
            message: "Campaign budget was exhausted before this click could be charged",
          };
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
