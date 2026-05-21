import crypto from "crypto";
import mongoose from "mongoose";
import geoip from "geoip-lite";
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
const CHARGE_LOCK_WINDOW_SECONDS = Number(process.env.PPC_CLICK_CHARGE_LOCK_SECONDS ?? 5);
const HASH_SALT = process.env.CLICK_TRACKING_HASH_SALT || process.env.JWTTOKENSECRET || "marketspase-click";
const KNOWN_NON_BILLABLE_UA_PATTERN =
  /facebookexternalhit|facebot|meta-externalagent|meta-externalfetcher|twitterbot|slackbot|telegrambot|discordbot|linkedinbot|skypeuripreview|googlebot|google-inspectiontool|googleother|bingbot|duckduckbot|applebot|crawler|spider|headlesschrome/i;

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

const normalizeIpForGeoLookup = (value = "") => {
  const ip = String(value || "").trim();
  if (!ip) return "";
  // Normalize IPv4-mapped IPv6 (e.g., "::ffff:1.2.3.4")
  if (ip.startsWith("::ffff:")) return ip.slice("::ffff:".length);
  // Drop IPv6 zone index if present (e.g., "fe80::1%lo0")
  return ip.split("%")[0];
};

const getRequestProto = (req) => {
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (typeof forwardedProto === "string" && forwardedProto.trim()) {
    return forwardedProto.split(",")[0].trim();
  }
  return req.protocol || "https";
};

const buildGoStageUrl = (req) => {
  // Preserve attribution params (utm_*, source, etc), but force go=1 and ensure redirect isn't bypassed.
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query || {})) {
    if (!key) continue;
    if (key === "go" || key === "redirect") continue;

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== undefined && entry !== null && String(entry).trim() !== "") {
          params.append(key, String(entry));
        }
      });
      continue;
    }

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  }

  params.set("go", "1");

  const basePath = String(req.originalUrl || "").split("?")[0] || req.path || "";
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
};

const buildCanonicalTrackingUrl = (req) => {
  const proto = getRequestProto(req);
  const host = req.get("host") || "";
  const basePath = String(req.originalUrl || "").split("?")[0] || req.path || "";
  if (!host) return basePath;
  return `${proto}://${host}${basePath}`;
};

const buildPreviewHtml = ({ title, description, imageUrl, canonicalUrl }) => { 
  const safe = (input) =>
    String(input || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const ogTitle = safe(title || "MarketSpase Promotion");
  const ogDescription = safe(description || "Open this link to view the offer.");
  const ogImage = safe(imageUrl || "https://marketspase.com/img/email_logo.jpg");
  const ogUrl = safe(canonicalUrl || "https://marketspase.com");

  return `<!doctype html> 
<html lang="en"> 
<head> 
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${ogTitle}</title>
  <meta name="robots" content="noindex,nofollow" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDescription}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:url" content="${ogUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${ogDescription}" />
  <meta name="twitter:image" content="${ogImage}" />
</head>
<body>
  <a href="${ogUrl}">Open</a>
</body>
</html>`; 
}; 

// Interstitial HTML used for the public tracking link.
// Social/link-preview crawlers do not execute JavaScript, so they will only read the OG tags
// and will not advance to the billable stage.
const buildTrackingLandingHtml = ({ title, description, imageUrl, canonicalUrl, nextUrl, fallbackUrl }) => {
  const safe = (input) =>
    String(input || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const ogTitle = safe(title || "MarketSpase Promotion");
  const ogDescription = safe(description || "Open this link to view the offer.");
  const ogImage = safe(imageUrl || "https://marketspase.com/img/email_logo.jpg");
  const ogUrl = safe(canonicalUrl || "https://marketspase.com");
  const next = safe(nextUrl || ogUrl);
  const fallback = safe(fallbackUrl || ogUrl);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${ogTitle}</title>
  <meta name="robots" content="noindex,nofollow" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDescription}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:url" content="${ogUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${ogDescription}" />
  <meta name="twitter:image" content="${ogImage}" />
  <script>
    (function () {
      try {
        window.location.replace(${JSON.stringify(next)});
      } catch (e) {
        window.location.href = ${JSON.stringify(next)};
      }
    })();
  </script>
</head>
<body>
  <noscript>
    <a href="${fallback}">Open</a>
  </noscript>
</body>
</html>`;
};

const getDeviceType = (userAgent = "") => {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobile|iphone|android/.test(ua)) return "mobile";
  if (ua) return "desktop";
  return "unknown";
};

const getHeaderValue = (req, name) => {
  const value = req.get(name);
  return typeof value === "string" ? value.trim() : "";
};

const getLowerHeaderValue = (req, name) =>
  getHeaderValue(req, name).toLowerCase();

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
  const chargeLockWindowMs = Math.max(CHARGE_LOCK_WINDOW_SECONDS, 1) * 1000;
  const chargeLockBucket = Math.floor(clickedAt.getTime() / chargeLockWindowMs);
  const dedupeKey = `${promotionId}:${ipHash}:${userAgentHash}:${bucket}`;
  return {
    dedupeKey,
    billableKey: dedupeKey,
    chargeLockKey: `${promotionId}:${ipHash}:${chargeLockBucket}`,
  };
};

const getNonBillableRequestReason = (req) => {
  const method = String(req.method || "GET").toUpperCase();
  if (method === "HEAD") {
    return "head_request";
  }

  const purposeHeaders = [
    getLowerHeaderValue(req, "purpose"),
    getLowerHeaderValue(req, "x-purpose"),
    getLowerHeaderValue(req, "sec-purpose"),
  ]
    .filter(Boolean)
    .join(" ");

  if (/(prefetch|preview|prerender)/i.test(purposeHeaders)) {
    return "prefetch_or_preview";
  }

  const secFetchMode = getLowerHeaderValue(req, "sec-fetch-mode");
  if (secFetchMode && secFetchMode !== "navigate") {
    return `sec_fetch_mode_${secFetchMode}`;
  }

  const secFetchDest = getLowerHeaderValue(req, "sec-fetch-dest");
  if (secFetchDest && !["document", "iframe"].includes(secFetchDest)) {
    return `sec_fetch_dest_${secFetchDest}`;
  }

  const requestUserAgent = String(req.headers["user-agent"] || "");
  // WhatsApp link preview crawler uses a UA that begins with "WhatsApp/<version>".
  // The in-app browser uses a normal Mozilla UA, so we only match the prefix form.
  if (/^whatsapp\//i.test(requestUserAgent.trim())) {
    return "whatsapp_link_preview";
  }
  if (KNOWN_NON_BILLABLE_UA_PATTERN.test(requestUserAgent)) {
    return "bot_or_preview_user_agent";
  }

  return null;
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
  if (result?.html) { 
    res.setHeader("Content-Type", "text/html; charset=utf-8"); 
    return res.status(result.httpStatus ?? 200).send(result.html); 
  } 
 
  if (req.query.redirect === "false") { 
    return res.status(result.httpStatus ?? 200).json({ 
      success: result.success, 
      message: result.message, 
      redirectUrl: result.redirectUrl || null,
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
  const goParam = String(req.query.go || "").toLowerCase();
  const isGoStage = ["1", "true", "yes", "go"].includes(goParam);
  const clientIp = getClientIp(req);
  const ipHash = hashValue(clientIp);
  const userAgentHash = hashValue(userAgent);
  const referrer = req.get("referer") || req.get("referrer") || "";
  const source = req.query.source || req.query.utm_source || "";
  const deviceType = getDeviceType(userAgent);
  const geoLookupIp = normalizeIpForGeoLookup(clientIp);
  const geo = geoLookupIp ? geoip.lookup(geoLookupIp) : null;

  // Hard gate: we ONLY ever charge/bill on the explicit billable stage (`go=1`).
  // Anything without `go=1` is treated as a preview/landing request (safe for link unfurlers,
  // prefetchers, and social crawlers) and will never hit billing logic.
  if (!isGoStage) {
    const nextUrl = buildGoStageUrl(req);

    // For normal browser navigation, serve an HTML interstitial with OG tags + a JS hop to go=1.
    // For API/XHR usage (including redirect=false callers), return JSON instructing the client
    // to call the go-stage URL.
    if (!isRedirectBypassed) {
      try {
        const promotion = await PromotionModel.findOne({ upi })
          .select("_id campaign promoter upi destinationUrl promotionUrl status isActive costPerClick");

        if (!promotion) {
          const unavailableUrl = buildCampaignUnavailableUrl({ reason: "invalid_link" });
          return sendTrackingResponse(req, res, {
            httpStatus: 410,
            html: buildTrackingLandingHtml({
              title: "MarketSpase Promotion",
              description: "This promotion link is no longer available.",
              canonicalUrl: buildCanonicalTrackingUrl(req),
              nextUrl: unavailableUrl,
              fallbackUrl: unavailableUrl,
            }),
            success: false,
            message: "Campaign is no longer available",
            data: { status: "invalid" },
          });
        }

        const campaign = await CampaignModel.findById(promotion.campaign)
          .select("_id title caption thumbnailUrl mediaUrl owner link status costPerClick payoutPerPromotion currency");

        const marketer = campaign
          ? await UserModel.findById(campaign.owner).select("personalInfo.phone personalInfo.phoneDetails")
          : null;

        const destinationUrl = campaign
          ? getDestinationUrl(promotion, campaign, marketer)
          : buildCampaignUnavailableUrl({ reason: "campaign_removed" });

        const canonicalUrl = buildCanonicalTrackingUrl(req);
        const imageUrl = campaign?.thumbnailUrl || campaign?.mediaUrl;
        const description = campaign?.caption || "Open this link to view the offer.";

        return sendTrackingResponse(req, res, {
          httpStatus: 200,
          html: buildTrackingLandingHtml({
            title: campaign?.title || "MarketSpase Promotion",
            description,
            imageUrl,
            canonicalUrl,
            nextUrl,
            // If JS is blocked, the user can still proceed by tapping the link.
            fallbackUrl: nextUrl,
          }),
          success: true,
          message: "Tracking link landing",
          data: { stage: "landing", destinationUrl },
        });
      } catch (error) {
        console.error("Failed to build tracking landing HTML:", error?.message || error);

        // As a last resort, still serve a non-billable landing page without DB lookups.
        return sendTrackingResponse(req, res, {
          httpStatus: 200,
          html: buildTrackingLandingHtml({
            title: "MarketSpase Promotion",
            description: "Open this link to view the offer.",
            canonicalUrl: buildCanonicalTrackingUrl(req),
            nextUrl,
            fallbackUrl: nextUrl,
          }),
          success: true,
          message: "Tracking link landing",
          data: { stage: "landing" },
        });
      }
    }

    return sendTrackingResponse(req, res, {
      httpStatus: 200,
      success: true,
      message: "Tracking link landing (go-stage required)",
      data: { stage: "landing", nextUrl },
    });
  }

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

        const { dedupeKey, billableKey, chargeLockKey } = buildClickKeys({
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
          ip: clientIp,
          userAgentHash,
          deviceType,
          geo: geo
            ? {
                country: geo.country || "",
                region: geo.region || "",
                city: geo.city || "",
                timezone: geo.timezone || "",
                ll: Array.isArray(geo.ll) ? geo.ll : undefined,
              }
            : undefined,
          dedupeKey,
        };

        const nonBillableReason = getNonBillableRequestReason(req);
        if (nonBillableReason) {
          const click = await createClickAudit({
            session,
            click: {
              ...baseClick,
              cost: 0,
              status: "duplicate",
              chargeStatus: "not_charged",
              metadata: { reason: nonBillableReason },
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
            message: "Non-billable request recorded without charge",
            // For link preview / crawler fetches, don't redirect to the destination.
            // This prevents external crawlers from artificially inflating destination analytics
            // and avoids triggering downstream side effects.
            httpStatus: 200,
            html: buildPreviewHtml({
              title: campaign.title || "MarketSpase Promotion",
              description: "Open this link to view the offer.",
              canonicalUrl: destinationUrl,
            }),
            data: { clickId: click._id, status: "duplicate", charged: false },
          };
          return;
        }

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

        const duplicate = await CampaignClickModel.exists({
          $or: [{ billableKey }, { chargeLockKey }],
        }).session(session);
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
            chargeLockKey,
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
