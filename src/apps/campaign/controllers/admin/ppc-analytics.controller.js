import mongoose from "mongoose";
import { CampaignClickModel, CampaignModel } from "../../models/index.js";
import { PromotionModel } from "../../../promotion/models/index.js";
import { UserModel } from "../../../user/models/user/index.js";
import { OrderModel } from "../../../store/models/order/index.js";
import { NotificationService } from "../../../notification/services/notification.service.js";

const DEFAULT_RANGE_DAYS = 7;

const toObjectId = (value) => new mongoose.Types.ObjectId(String(value));
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

const getDateRange = ({ startDate, endDate, range }) => {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - ((Number.parseInt(range, 10) || DEFAULT_RANGE_DAYS) * 24 * 60 * 60 * 1000));

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const safeNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const computeRates = (row) => {
  const totalClicks = safeNumber(row.totalClicks);
  const billableClicks = safeNumber(row.billableClicks);
  const invalidClicks = safeNumber(row.invalidClicks);
  const duplicateClicks = safeNumber(row.duplicateClicks);
  const conversions = safeNumber(row.conversions);

  const billableRate = totalClicks > 0 ? (billableClicks / totalClicks) * 100 : 0;
  const invalidRate = totalClicks > 0 ? (invalidClicks / totalClicks) * 100 : 0;
  const duplicateRate = totalClicks > 0 ? (duplicateClicks / totalClicks) * 100 : 0;
  const clickToConversionRate = billableClicks > 0 ? (conversions / billableClicks) * 100 : 0;

  return {
    billableRate: Number(billableRate.toFixed(2)),
    invalidRate: Number(invalidRate.toFixed(2)),
    duplicateRate: Number(duplicateRate.toFixed(2)),
    clickToConversionRate: Number(clickToConversionRate.toFixed(2)),
  };
};

const buildFallbackPromotionUrl = (req, upi) => {
  const normalizedUpi = String(upi || "").trim();
  if (!normalizedUpi) return "";

  const configuredApiUrl = String(process.env.API_URL || process.env.BASE_URL || "").replace(/\/+$/, "");
  const requestBaseUrl = `${req.protocol}://${req.get("host")}`.replace(/\/+$/, "");
  const baseUrl = configuredApiUrl || requestBaseUrl;

  return `${baseUrl}/api/v1/campaign/track/${encodeURIComponent(normalizedUpi)}`;
};

const detectAnomalies = (row) => {
  const totalClicks = safeNumber(row.totalClicks);
  const billableClicks = safeNumber(row.billableClicks);
  const invalidClicks = safeNumber(row.invalidClicks);
  const duplicateClicks = safeNumber(row.duplicateClicks);
  const spend = safeNumber(row.spend);
  const uniqueClicks = safeNumber(row.uniqueClicks);
  const conversions = safeNumber(row.conversions);

  const rates = computeRates(row);
  const anomalies = [];

  if (billableClicks >= 500) anomalies.push("high_click_volume");
  if (totalClicks >= 700 && rates.billableRate < 35) anomalies.push("low_billable_rate");
  if (totalClicks >= 200 && rates.invalidRate >= 30) anomalies.push("high_invalid_rate");
  if (totalClicks >= 200 && rates.duplicateRate >= 50) anomalies.push("high_duplicate_rate");
  if (uniqueClicks > 0 && billableClicks > 0 && billableClicks > uniqueClicks * 1.4) anomalies.push("repeat_click_pattern");
  if (spend >= 50000 && rates.billableRate < 50) anomalies.push("high_spend_low_quality");
  if (billableClicks >= 80 && conversions === 0) anomalies.push("zero_conversions");
  if (billableClicks >= 150 && rates.clickToConversionRate < 0.5) anomalies.push("low_conversion_rate");

  return anomalies;
};

const buildClickMatch = ({
  startDate,
  endDate,
  range,
  promoterId,
  country,
}) => {
  const { start, end } = getDateRange({ startDate, endDate, range });
  const match = {
    clickedAt: { $gte: start, $lte: end },
  };

  if (promoterId) {
    match.promoter = toObjectId(promoterId);
  }

  if (country) {
    match["geo.country"] = String(country).trim().toUpperCase();
  }

  return match;
};

const buildOrderMatch = ({ startDate, endDate, range, promoterId }) => {
  const { start, end } = getDateRange({ startDate, endDate, range });
  const match = {
    createdAt: { $gte: start, $lte: end },
    paymentStatus: "paid",
    status: { $nin: ["cancelled", "refunded"] },
    "items.promoterId": { $exists: true, $ne: null },
  };

  if (promoterId && isValidObjectId(promoterId)) {
    match["items.promoterId"] = toObjectId(promoterId);
  }

  return match;
};

export const getAdminPpcAnalyticsOverviewController = async (req, res) => {
  try {
    const { startDate, endDate, range, promoterId, country, granularity = "daily" } = req.query || {};

    const match = buildClickMatch({ startDate, endDate, range, promoterId, country });
    const format = granularity === "hourly" ? "%Y-%m-%d %H:00" : "%Y-%m-%d";

    const [summaryRows, uniqueRows, timeSeriesRows, conversionRows] = await Promise.all([
      CampaignClickModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalClicks: { $sum: 1 },
            billableClicks: { $sum: { $cond: [{ $eq: ["$status", "billable"] }, 1, 0] } },
            invalidClicks: { $sum: { $cond: [{ $eq: ["$status", "invalid"] }, 1, 0] } },
            duplicateClicks: { $sum: { $cond: [{ $eq: ["$status", "duplicate"] }, 1, 0] } },
            spend: { $sum: { $cond: [{ $eq: ["$status", "billable"] }, "$cost", 0] } },
            uniquePromoters: { $addToSet: "$promoter" },
          },
        },
      ], { allowDiskUse: true }),
      CampaignClickModel.aggregate([
        { $match: match },
        { $group: { _id: "$dedupeKey" } },
        { $count: "uniqueClicks" },
      ], { allowDiskUse: true }),
      CampaignClickModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              bucket: { $dateToString: { format, date: "$clickedAt" } },
            },
            totalClicks: { $sum: 1 },
            billableClicks: { $sum: { $cond: [{ $eq: ["$status", "billable"] }, 1, 0] } },
            invalidClicks: { $sum: { $cond: [{ $eq: ["$status", "invalid"] }, 1, 0] } },
            duplicateClicks: { $sum: { $cond: [{ $eq: ["$status", "duplicate"] }, 1, 0] } },
            spend: { $sum: { $cond: [{ $eq: ["$status", "billable"] }, "$cost", 0] } },
          },
        },
        { $sort: { "_id.bucket": 1 } },
      ], { allowDiskUse: true }),
      OrderModel.aggregate([
        { $match: buildOrderMatch({ startDate, endDate, range, promoterId }) },
        { $unwind: "$items" },
        { $match: promoterId && isValidObjectId(promoterId) ? { "items.promoterId": toObjectId(promoterId) } : { "items.promoterId": { $ne: null } } },
        {
          $group: {
            _id: null,
            conversions: { $sum: 1 },
            conversionRevenue: { $sum: "$items.totalPrice" },
          },
        },
      ], { allowDiskUse: true }),
    ]);

    const summary = summaryRows?.[0] || {};
    const uniquePromoters = Array.isArray(summary.uniquePromoters) ? summary.uniquePromoters.length : 0;
    const uniqueClicks = safeNumber(uniqueRows?.[0]?.uniqueClicks);
    const conversion = conversionRows?.[0] || {};
    const enrichedSummary = {
      ...summary,
      uniqueClicks,
      conversions: safeNumber(conversion.conversions),
      conversionRevenue: safeNumber(conversion.conversionRevenue),
    };
    const rates = computeRates(enrichedSummary);

    return res.status(200).json({
      success: true,
      data: {
        range: getDateRange({ startDate, endDate, range }),
        summary: {
          totalClicks: safeNumber(summary.totalClicks),
          uniqueClicks,
          billableClicks: safeNumber(summary.billableClicks),
          invalidClicks: safeNumber(summary.invalidClicks),
          duplicateClicks: safeNumber(summary.duplicateClicks),
          spend: safeNumber(summary.spend),
          conversions: safeNumber(conversion.conversions),
          conversionRevenue: safeNumber(conversion.conversionRevenue),
          uniquePromoters,
          ...rates,
        },
        timeSeries: timeSeriesRows.map((row) => ({
          bucket: row._id?.bucket,
          totalClicks: safeNumber(row.totalClicks),
          billableClicks: safeNumber(row.billableClicks),
          invalidClicks: safeNumber(row.invalidClicks),
          duplicateClicks: safeNumber(row.duplicateClicks),
          spend: safeNumber(row.spend),
          ...computeRates(row),
        })),
      },
    });
  } catch (error) {
    console.error("Admin PPC analytics overview error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to load PPC analytics overview",
    });
  }
};

export const getAdminPpcAnalyticsPromotersController = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      range,
      promoterId,
      country,
      page = 1,
      limit = 25,
      sortBy = "billableClicks",
      sortOrder = "desc",
    } = req.query || {};

    const match = buildClickMatch({ startDate, endDate, range, promoterId, country });
    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(5, Number.parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const sortDirection = String(sortOrder).toLowerCase() === "asc" ? 1 : -1;
    const allowedSorts = new Set(["billableClicks", "totalClicks", "spend", "invalidClicks", "duplicateClicks", "lastClickAt"]);
    const sortField = allowedSorts.has(String(sortBy)) ? String(sortBy) : "billableClicks";
    const sortStage = { [sortField]: sortDirection, totalClicks: -1 };

    const [totalDistinctPromotersRows, promoterRows] = await Promise.all([
      CampaignClickModel.aggregate([
        { $match: match },
        { $group: { _id: "$promoter" } },
        { $count: "total" },
      ], { allowDiskUse: true }),
      CampaignClickModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$promoter",
            totalClicks: { $sum: 1 },
            billableClicks: { $sum: { $cond: [{ $eq: ["$status", "billable"] }, 1, 0] } },
            invalidClicks: { $sum: { $cond: [{ $eq: ["$status", "invalid"] }, 1, 0] } },
            duplicateClicks: { $sum: { $cond: [{ $eq: ["$status", "duplicate"] }, 1, 0] } },
            spend: { $sum: { $cond: [{ $eq: ["$status", "billable"] }, "$cost", 0] } },
            lastClickAt: { $max: "$clickedAt" },
          },
        },
        { $sort: sortStage },
        { $skip: skip },
        { $limit: limitNum },
      ], { allowDiskUse: true }),
    ]);

    const promoterIds = promoterRows.map((row) => row._id).filter(Boolean);
    if (!promoterIds.length) {
      return res.status(200).json({
        success: true,
        data: {
          promoters: [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: 0,
            totalPages: 0,
          },
        },
      });
    }

    const [uniqueRows, promoterProfiles, topPromotionRows, ipPatternRows, deviceRows, countryRows, conversionRows] = await Promise.all([
      CampaignClickModel.aggregate([
        { $match: { ...match, promoter: { $in: promoterIds } } },
        { $group: { _id: { promoter: "$promoter", dedupeKey: "$dedupeKey" } } },
        { $group: { _id: "$_id.promoter", uniqueClicks: { $sum: 1 } } },
      ], { allowDiskUse: true }),
      UserModel.find({ _id: { $in: promoterIds } })
        .select("_id displayName username email isActive personalInfo.phone personalInfo.phoneDetails fraudProfile")
        .lean(),
      CampaignClickModel.aggregate([
        { $match: { ...match, promoter: { $in: promoterIds }, status: "billable" } },
        {
          $group: {
            _id: { promoter: "$promoter", promotion: "$promotion", campaign: "$campaign", marketer: "$marketer" },
            billableClicks: { $sum: 1 },
            spend: { $sum: "$cost" },
            lastClickAt: { $max: "$clickedAt" },
          },
        },
        { $sort: { billableClicks: -1, lastClickAt: -1 } },
        { $group: { _id: "$_id.promoter", top: { $first: "$$ROOT" } } },
        {
          $project: {
            _id: 0,
            promoter: "$_id",
            promotionId: "$top._id.promotion",
            campaignId: "$top._id.campaign",
            marketerId: "$top._id.marketer",
            billableClicks: "$top.billableClicks",
            spend: "$top.spend",
            lastClickAt: "$top.lastClickAt",
          },
        },
      ], { allowDiskUse: true }),
      CampaignClickModel.aggregate([
        { $match: { ...match, promoter: { $in: promoterIds } } },
        {
          $group: {
            _id: {
              promoter: "$promoter",
              ip: "$ip",
              country: "$geo.country",
            },
            clicks: { $sum: 1 },
            billableClicks: { $sum: { $cond: [{ $eq: ["$status", "billable"] }, 1, 0] } },
            lastClickAt: { $max: "$clickedAt" },
          },
        },
        { $sort: { billableClicks: -1, clicks: -1 } },
        {
          $group: {
            _id: "$_id.promoter",
            ips: {
              $push: {
                ip: "$_id.ip",
                country: "$_id.country",
                clicks: "$clicks",
                billableClicks: "$billableClicks",
                lastClickAt: "$lastClickAt",
              },
            },
          },
        },
        { $project: { ips: { $slice: ["$ips", 5] } } },
      ], { allowDiskUse: true }),
      CampaignClickModel.aggregate([
        { $match: { ...match, promoter: { $in: promoterIds } } },
        {
          $group: {
            _id: { promoter: "$promoter", deviceType: "$deviceType" },
            clicks: { $sum: 1 },
            billableClicks: { $sum: { $cond: [{ $eq: ["$status", "billable"] }, 1, 0] } },
          },
        },
        { $sort: { billableClicks: -1, clicks: -1 } },
        {
          $group: {
            _id: "$_id.promoter",
            devices: {
              $push: {
                deviceType: "$_id.deviceType",
                clicks: "$clicks",
                billableClicks: "$billableClicks",
              },
            },
          },
        },
      ], { allowDiskUse: true }),
      CampaignClickModel.aggregate([
        { $match: { ...match, promoter: { $in: promoterIds } } },
        {
          $group: {
            _id: { promoter: "$promoter", country: "$geo.country" },
            clicks: { $sum: 1 },
            billableClicks: { $sum: { $cond: [{ $eq: ["$status", "billable"] }, 1, 0] } },
          },
        },
        { $sort: { billableClicks: -1, clicks: -1 } },
        {
          $group: {
            _id: "$_id.promoter",
            countries: {
              $push: {
                country: "$_id.country",
                clicks: "$clicks",
                billableClicks: "$billableClicks",
              },
            },
          },
        },
        { $project: { countries: { $slice: ["$countries", 5] } } },
      ], { allowDiskUse: true }),
      OrderModel.aggregate([
        { $match: buildOrderMatch({ startDate, endDate, range, promoterId: null }) },
        { $unwind: "$items" },
        { $match: { "items.promoterId": { $in: promoterIds } } },
        {
          $group: {
            _id: "$items.promoterId",
            conversions: { $sum: 1 },
            conversionRevenue: { $sum: "$items.totalPrice" },
          },
        },
      ], { allowDiskUse: true }),
    ]);

    const uniqueByPromoter = new Map(uniqueRows.map((row) => [String(row._id), safeNumber(row.uniqueClicks)]));
    const profileByPromoter = new Map(promoterProfiles.map((u) => [String(u._id), u]));
    const topPromotionByPromoter = new Map(topPromotionRows.map((row) => [String(row.promoter), row]));
    const ipsByPromoter = new Map(ipPatternRows.map((row) => [String(row._id), row.ips || []]));
    const devicesByPromoter = new Map(deviceRows.map((row) => [String(row._id), row.devices || []]));
    const countriesByPromoter = new Map(countryRows.map((row) => [String(row._id), row.countries || []]));
    const conversionsByPromoter = new Map(conversionRows.map((row) => [String(row._id), {
      conversions: safeNumber(row.conversions),
      conversionRevenue: safeNumber(row.conversionRevenue),
    }]));

    const promoters = promoterRows.map((row) => {
      const promoterIdString = String(row._id);
      const profile = profileByPromoter.get(promoterIdString) || {};
      const uniqueClicks = uniqueByPromoter.get(promoterIdString) || 0;
      const conversions = conversionsByPromoter.get(promoterIdString) || { conversions: 0, conversionRevenue: 0 };
      const rates = computeRates(row);

      const enriched = {
        promoter: {
          _id: promoterIdString,
          displayName: profile.displayName || profile.username || "Promoter",
          email: profile.email || "",
          phone:
            profile?.personalInfo?.phoneDetails?.fullNumber ||
            profile?.personalInfo?.phone ||
            "",
          isActive: profile.isActive !== false,
          fraudProfile: profile.fraudProfile || {},
        },
        metrics: {
          totalClicks: safeNumber(row.totalClicks),
          uniqueClicks,
          billableClicks: safeNumber(row.billableClicks),
          invalidClicks: safeNumber(row.invalidClicks),
          duplicateClicks: safeNumber(row.duplicateClicks),
          spend: safeNumber(row.spend),
          conversions: conversions.conversions,
          conversionRevenue: conversions.conversionRevenue,
          lastClickAt: row.lastClickAt || null,
          ...rates,
        },
        patterns: {
          ips: ipsByPromoter.get(promoterIdString) || [],
          devices: devicesByPromoter.get(promoterIdString) || [],
          countries: countriesByPromoter.get(promoterIdString) || [],
        },
        primaryAttribution: topPromotionByPromoter.get(promoterIdString) || null,
      };

      return {
        ...enriched,
        anomalies: detectAnomalies({
          ...row,
          uniqueClicks,
          conversions: conversions.conversions,
        }),
      };
    });

    const total = safeNumber(totalDistinctPromotersRows?.[0]?.total);
    const totalPages = total > 0 ? Math.ceil(total / limitNum) : 0;

    return res.status(200).json({
      success: true,
      data: {
        promoters,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error("Admin PPC analytics promoters error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to load promoter PPC analytics",
    });
  }
};

export const getAdminPpcPromoterPromotionLinksController = async (req, res) => {
  try {
    const promoterId = req.params.promoterId || req.query?.promoterId;

    if (!isValidObjectId(promoterId)) {
      return res.status(400).json({ success: false, message: "Invalid promoter id" });
    }

    const {
      startDate,
      endDate,
      range,
      country,
      page = 1,
      limit = 20,
      sortBy = "spend",
      sortOrder = "desc",
    } = req.query || {};

    const match = buildClickMatch({ startDate, endDate, range, promoterId, country });
    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(5, Number.parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const sortDirection = String(sortOrder).toLowerCase() === "asc" ? 1 : -1;
    const allowedSorts = new Set([
      "spend",
      "billableClicks",
      "totalClicks",
      "invalidClicks",
      "duplicateClicks",
      "lastClickAt",
    ]);
    const sortField = allowedSorts.has(String(sortBy)) ? String(sortBy) : "spend";
    const sortStage = { [sortField]: sortDirection, totalClicks: -1, lastClickAt: -1 };

    const [totalRows, summaryRows, linkRows] = await Promise.all([
      CampaignClickModel.aggregate([
        { $match: match },
        { $group: { _id: "$promotion" } },
        { $count: "total" },
      ], { allowDiskUse: true }),
      CampaignClickModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalClicks: { $sum: 1 },
            billableClicks: { $sum: { $cond: [{ $eq: ["$status", "billable"] }, 1, 0] } },
            invalidClicks: { $sum: { $cond: [{ $eq: ["$status", "invalid"] }, 1, 0] } },
            duplicateClicks: { $sum: { $cond: [{ $eq: ["$status", "duplicate"] }, 1, 0] } },
            exhaustedClicks: { $sum: { $cond: [{ $eq: ["$status", "exhausted"] }, 1, 0] } },
            spend: { $sum: { $cond: [{ $eq: ["$status", "billable"] }, "$cost", 0] } },
            promotions: { $addToSet: "$promotion" },
            dedupeKeys: { $addToSet: "$dedupeKey" },
          },
        },
      ], { allowDiskUse: true }),
      CampaignClickModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              promotion: "$promotion",
              campaign: "$campaign",
              marketer: "$marketer",
              upi: "$upi",
            },
            totalClicks: { $sum: 1 },
            billableClicks: { $sum: { $cond: [{ $eq: ["$status", "billable"] }, 1, 0] } },
            invalidClicks: { $sum: { $cond: [{ $eq: ["$status", "invalid"] }, 1, 0] } },
            duplicateClicks: { $sum: { $cond: [{ $eq: ["$status", "duplicate"] }, 1, 0] } },
            exhaustedClicks: { $sum: { $cond: [{ $eq: ["$status", "exhausted"] }, 1, 0] } },
            spend: { $sum: { $cond: [{ $eq: ["$status", "billable"] }, "$cost", 0] } },
            unitCost: { $max: "$unitCost" },
            firstClickAt: { $min: "$clickedAt" },
            lastClickAt: { $max: "$clickedAt" },
            destinationUrl: { $first: "$destinationUrl" },
            sources: { $addToSet: "$source" },
            countries: { $addToSet: "$geo.country" },
            devices: { $addToSet: "$deviceType" },
            dedupeKeys: { $addToSet: "$dedupeKey" },
          },
        },
        {
          $addFields: {
            uniqueClicks: {
              $size: {
                $filter: {
                  input: "$dedupeKeys",
                  as: "key",
                  cond: { $and: [{ $ne: ["$$key", null] }, { $ne: ["$$key", ""] }] },
                },
              },
            },
          },
        },
        { $sort: sortStage },
        { $skip: skip },
        { $limit: limitNum },
      ], { allowDiskUse: true }),
    ]);

    const promotionIds = linkRows.map((row) => row._id?.promotion).filter(Boolean);
    const campaignIds = linkRows.map((row) => row._id?.campaign).filter(Boolean);
    const upis = linkRows.map((row) => String(row._id?.upi || "").trim()).filter(Boolean);

    const [promotions, campaigns, recentClickRows, conversionRows] = await Promise.all([
      promotionIds.length
        ? PromotionModel.find({ _id: { $in: promotionIds } })
          .select("_id campaign promoter status isActive upi promotionUrl destinationUrl clickStats fraudStatus acceptedAt createdAt updatedAt")
          .lean()
        : [],
      campaignIds.length
        ? CampaignModel.find({ _id: { $in: campaignIds } })
          .select("_id title status category mediaType link costPerClick budget spentBudget currency owner startDate endDate")
          .lean()
        : [],
      promotionIds.length
        ? CampaignClickModel.aggregate([
          { $match: { ...match, promotion: { $in: promotionIds } } },
          { $sort: { clickedAt: -1 } },
          {
            $group: {
              _id: "$promotion",
              recentClicks: {
                $push: {
                  clickedAt: "$clickedAt",
                  status: "$status",
                  chargeStatus: "$chargeStatus",
                  cost: "$cost",
                  deviceType: "$deviceType",
                  ip: "$ip",
                  country: "$geo.country",
                  region: "$geo.region",
                  city: "$geo.city",
                  source: "$source",
                  referrer: "$referrer",
                },
              },
            },
          },
          { $project: { _id: 1, recentClicks: { $slice: ["$recentClicks", 5] } } },
        ], { allowDiskUse: true })
        : [],
      upis.length
        ? OrderModel.aggregate([
          { $match: buildOrderMatch({ startDate, endDate, range, promoterId }) },
          { $unwind: "$items" },
          {
            $match: {
              "items.promoterId": toObjectId(promoterId),
              "items.trackingCode": { $in: upis },
            },
          },
          {
            $group: {
              _id: "$items.trackingCode",
              conversions: { $sum: 1 },
              conversionRevenue: { $sum: "$items.totalPrice" },
              commissionEarned: { $sum: "$items.commissionEarned" },
            },
          },
        ], { allowDiskUse: true })
        : [],
    ]);

    const promotionById = new Map(promotions.map((promotion) => [String(promotion._id), promotion]));
    const campaignById = new Map(campaigns.map((campaign) => [String(campaign._id), campaign]));
    const recentClicksByPromotion = new Map(recentClickRows.map((row) => [String(row._id), row.recentClicks || []]));
    const conversionsByUpi = new Map(conversionRows.map((row) => [String(row._id), {
      conversions: safeNumber(row.conversions),
      conversionRevenue: safeNumber(row.conversionRevenue),
      commissionEarned: safeNumber(row.commissionEarned),
    }]));

    const links = linkRows.map((row) => {
      const promotionId = String(row._id?.promotion || "");
      const campaignId = String(row._id?.campaign || "");
      const upi = String(row._id?.upi || "").trim();
      const promotion = promotionById.get(promotionId) || {};
      const campaign = campaignById.get(campaignId) || {};
      const conversion = conversionsByUpi.get(upi) || { conversions: 0, conversionRevenue: 0, commissionEarned: 0 };
      const promotionUrl = promotion.promotionUrl || buildFallbackPromotionUrl(req, upi);
      const destinationUrl = promotion.destinationUrl || row.destinationUrl || campaign.link || "";
      const metrics = {
        totalClicks: safeNumber(row.totalClicks),
        uniqueClicks: safeNumber(row.uniqueClicks),
        billableClicks: safeNumber(row.billableClicks),
        invalidClicks: safeNumber(row.invalidClicks),
        duplicateClicks: safeNumber(row.duplicateClicks),
        exhaustedClicks: safeNumber(row.exhaustedClicks),
        spend: safeNumber(row.spend),
        unitCost: safeNumber(row.unitCost),
        conversions: conversion.conversions,
        conversionRevenue: conversion.conversionRevenue,
        commissionEarned: conversion.commissionEarned,
        firstClickAt: row.firstClickAt || null,
        lastClickAt: row.lastClickAt || null,
      };

      return {
        promotionId,
        campaignId,
        marketerId: String(row._id?.marketer || campaign.owner || ""),
        upi,
        promotionUrl,
        destinationUrl,
        campaign: {
          _id: campaignId,
          title: campaign.title || "Untitled campaign",
          status: campaign.status || "",
          category: campaign.category || "",
          mediaType: campaign.mediaType || "",
          costPerClick: safeNumber(campaign.costPerClick),
          budget: safeNumber(campaign.budget),
          spentBudget: safeNumber(campaign.spentBudget),
          currency: campaign.currency || "NGN",
        },
        promotion: {
          _id: promotionId,
          status: promotion.status || "",
          isActive: promotion.isActive !== false,
          acceptedAt: promotion.acceptedAt || null,
          fraudStatus: promotion.fraudStatus || {},
        },
        metrics: {
          ...metrics,
          ...computeRates(metrics),
        },
        patterns: {
          sources: (row.sources || []).filter(Boolean).slice(0, 8),
          countries: (row.countries || []).filter(Boolean).slice(0, 8),
          devices: (row.devices || []).filter(Boolean).slice(0, 8),
        },
        recentClicks: recentClicksByPromotion.get(promotionId) || [],
        anomalies: detectAnomalies(metrics),
      };
    });

    const summary = summaryRows?.[0] || {};
    const cleanDedupeKeys = Array.isArray(summary.dedupeKeys)
      ? summary.dedupeKeys.filter((key) => key !== null && key !== "")
      : [];
    const total = safeNumber(totalRows?.[0]?.total);
    const totalPages = total > 0 ? Math.ceil(total / limitNum) : 0;
    const summaryMetrics = {
      totalClicks: safeNumber(summary.totalClicks),
      uniqueClicks: cleanDedupeKeys.length,
      billableClicks: safeNumber(summary.billableClicks),
      invalidClicks: safeNumber(summary.invalidClicks),
      duplicateClicks: safeNumber(summary.duplicateClicks),
      exhaustedClicks: safeNumber(summary.exhaustedClicks),
      spend: safeNumber(summary.spend),
      promotionLinks: Array.isArray(summary.promotions) ? summary.promotions.length : 0,
    };

    return res.status(200).json({
      success: true,
      data: {
        promoterId: String(promoterId),
        range: getDateRange({ startDate, endDate, range }),
        summary: {
          ...summaryMetrics,
          ...computeRates(summaryMetrics),
        },
        links,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error("Admin PPC promoter promotion links error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to load promoter promotion link attribution",
    });
  }
};

export const flagPpcPromoterController = async (req, res) => {
  try {
    const promoterId = req.params.promoterId || req.body?.promoterId;
    const reason = String(req.body?.reason || "").trim();

    if (!isValidObjectId(promoterId)) {
      return res.status(400).json({ success: false, message: "Invalid promoter id" });
    }

    const promoter = await UserModel.findById(promoterId).select("_id fraudProfile isActive isDeleted displayName username email activityLog");
    if (!promoter || promoter.isDeleted) {
      return res.status(404).json({ success: false, message: "Promoter not found" });
    }

    const now = new Date();
    promoter.fraudProfile = promoter.fraudProfile || {};
    promoter.fraudProfile.lastFlaggedAt = now;
    if (!["medium", "high", "critical"].includes(promoter.fraudProfile.riskLevel)) {
      promoter.fraudProfile.riskLevel = "medium";
    }
    if (reason) {
      const existing = String(promoter.fraudProfile.notes || "").trim();
      const next = `${existing ? `${existing}\n` : ""}[${now.toISOString()}] PPC flag: ${reason}`;
      promoter.fraudProfile.notes = next.slice(0, 2000);
    }

    promoter.activityLog = promoter.activityLog || [];
    promoter.activityLog.unshift({
      action: "system_event",
      description: `Flagged for PPC review${reason ? `: ${reason}` : "."}`,
      resourceType: "user",
      resourceId: promoter._id,
      metadata: { source: "ppc_analytics", reason: reason || undefined },
      severity: "warning",
      timestamp: now,
    });
    promoter.activityLog = promoter.activityLog.slice(0, 500);

    await promoter.save();

    return res.status(200).json({
      success: true,
      message: "Promoter flagged for review",
      data: { promoterId: String(promoter._id), flaggedAt: now.toISOString() },
    });
  } catch (error) {
    console.error("Flag PPC promoter error:", error);
    return res.status(500).json({ success: false, message: "Failed to flag promoter" });
  }
};

export const warnPpcPromoterController = async (req, res) => {
  try {
    const promoterId = req.params.promoterId || req.body?.promoterId;
    const message = String(req.body?.message || req.body?.reason || "").trim();

    if (!isValidObjectId(promoterId)) {
      return res.status(400).json({ success: false, message: "Invalid promoter id" });
    }

    const promoter = await UserModel.findById(promoterId).select("_id fraudProfile isActive isDeleted displayName username email activityLog");
    if (!promoter || promoter.isDeleted) {
      return res.status(404).json({ success: false, message: "Promoter not found" });
    }

    const now = new Date();
    promoter.fraudProfile = promoter.fraudProfile || {};
    promoter.fraudProfile.warningCount = safeNumber(promoter.fraudProfile.warningCount) + 1;
    promoter.fraudProfile.lastWarningAt = now;
    if (promoter.fraudProfile.warningCount >= 3 && promoter.fraudProfile.riskLevel !== "critical") {
      promoter.fraudProfile.riskLevel = "high";
    } else if (!["medium", "high", "critical"].includes(promoter.fraudProfile.riskLevel)) {
      promoter.fraudProfile.riskLevel = "medium";
    }

    promoter.activityLog = promoter.activityLog || [];
    promoter.activityLog.unshift({
      action: "system_event",
      description: `PPC warning sent${message ? `: ${message}` : "."}`,
      resourceType: "user",
      resourceId: promoter._id,
      metadata: { source: "ppc_analytics", message: message || undefined },
      severity: "warning",
      timestamp: now,
    });
    promoter.activityLog = promoter.activityLog.slice(0, 500);
    await promoter.save();

    await NotificationService.createNotification({
      recipient: promoter._id,
      type: "system_notice",
      title: "Account Warning",
      message: message || "We detected unusual PPC activity on your account. Please review the promotion policies to avoid restrictions.",
      data: { promoterId: String(promoter._id), source: "ppc_analytics" },
      priority: "high",
    });

    return res.status(200).json({
      success: true,
      message: "Warning sent",
      data: {
        promoterId: String(promoter._id),
        warningCount: promoter.fraudProfile.warningCount,
        lastWarningAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error("Warn PPC promoter error:", error);
    return res.status(500).json({ success: false, message: "Failed to send warning" });
  }
};

export const suspendPpcPromoterController = async (req, res) => {
  try {
    const promoterId = req.params.promoterId || req.body?.promoterId;
    const reason = String(req.body?.reason || "").trim();

    if (!isValidObjectId(promoterId)) {
      return res.status(400).json({ success: false, message: "Invalid promoter id" });
    }

    const promoter = await UserModel.findById(promoterId).select("_id isActive isDeleted fraudProfile displayName username email activityLog");
    if (!promoter || promoter.isDeleted) {
      return res.status(404).json({ success: false, message: "Promoter not found" });
    }

    const now = new Date();
    promoter.isActive = false;
    promoter.fraudProfile = promoter.fraudProfile || {};
    promoter.fraudProfile.suspensionReason = reason || "Suspended by admin (PPC)";

    promoter.activityLog = promoter.activityLog || [];
    promoter.activityLog.unshift({
      action: "account_suspend",
      description: `Account suspended (PPC)${reason ? `: ${reason}` : "."}`,
      resourceType: "user",
      resourceId: promoter._id,
      metadata: { source: "ppc_analytics", reason: reason || undefined },
      severity: "critical",
      timestamp: now,
    });
    promoter.activityLog = promoter.activityLog.slice(0, 500);

    await promoter.save();

    await NotificationService.createNotification({
      recipient: promoter._id,
      type: "account_suspended",
      title: "Account Suspended",
      message: reason || "Your account has been suspended due to PPC policy violations. Contact support for review.",
      data: { promoterId: String(promoter._id), source: "ppc_analytics" },
      priority: "high",
    });

    return res.status(200).json({
      success: true,
      message: "Account suspended",
      data: { promoterId: String(promoter._id), isActive: promoter.isActive },
    });
  } catch (error) {
    console.error("Suspend PPC promoter error:", error);
    return res.status(500).json({ success: false, message: "Failed to suspend account" });
  }
};
