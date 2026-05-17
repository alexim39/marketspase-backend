import mongoose from "mongoose";
import { CampaignClickModel, CampaignModel } from "../models/index.js";
import { PromotionModel } from "../../promotion/models/index.js";

const DEFAULT_RANGE_DAYS = 30;

const toObjectId = (value) => new mongoose.Types.ObjectId(value);

const round = (value) => Number(Number(value || 0).toFixed(2));

const getDateRange = ({ startDate, endDate, range }) => {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - ((Number.parseInt(range, 10) || DEFAULT_RANGE_DAYS) * 24 * 60 * 60 * 1000));

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const buildDateMatch = ({ startDate, endDate, range }) => {
  const { start, end } = getDateRange({ startDate, endDate, range });
  return {
    clickedAt: {
      $gte: start,
      $lte: end,
    },
  };
};

const summarizeClicks = (row = {}) => {
  const trackedVisits = Number(row.totalClicks || 0);
  const billableClicks = Number(row.billableClicks || 0);
  const invalidClicks = Number(row.invalidClicks || 0);
  const duplicateClicks = Number(row.duplicateClicks || 0);
  const spend = Number(row.spend || 0);

  return {
    trackedVisits,
    billableClicks,
    invalidClicks,
    duplicateClicks,
    spend: round(spend),
    qualityRate: trackedVisits > 0 ? round((billableClicks / trackedVisits) * 100) : 0,
    averageCostPerBillableClick: billableClicks > 0 ? round(spend / billableClicks) : 0,
  };
};

const normalizeSource = (source = "") => {
  const value = String(source || "").trim();
  return value || "direct";
};

export const getMarketerAnalyticsSnapshot = async ({
  marketerId,
  campaignId = null,
  promoterId = null,
  startDate,
  endDate,
  range,
}) => {
  const campaignQuery = {
    owner: toObjectId(marketerId),
    isDeleted: { $ne: true },
  };

  if (campaignId) {
    campaignQuery._id = toObjectId(campaignId);
  }

  const campaigns = await CampaignModel.find(campaignQuery)
    .select("_id title status budget spentBudget totalClicks billableClicks invalidClicks duplicateClicks costPerClick createdAt updatedAt exhaustedAt")
    .sort({ createdAt: -1 })
    .lean();

  const campaignIds = campaigns.map((campaign) => campaign._id);
  if (!campaignIds.length) {
    return {
      summary: {
        totalCampaigns: 0,
        activeCampaigns: 0,
        activePromotions: 0,
        activePromoters: 0,
        trackedVisits: 0,
        billableClicks: 0,
        invalidClicks: 0,
        duplicateClicks: 0,
        spend: 0,
        remainingBudget: 0,
        qualityRate: 0,
        averageCostPerBillableClick: 0,
      },
      timeSeries: [],
      campaignBreakdown: [],
      promoterBreakdown: [],
      deviceBreakdown: [],
      sourceBreakdown: [],
    };
  }

  const promotionMatch = {
    campaign: { $in: campaignIds },
  };

  if (promoterId) {
    promotionMatch.promoter = toObjectId(promoterId);
  }

  const [promotionSummaryRows, clickSummaryRows, timeSeriesRows, clickByCampaignRows, clickByPromoterRows, deviceRows, sourceRows] = await Promise.all([
    PromotionModel.aggregate([
      { $match: promotionMatch },
      {
        $group: {
          _id: "$campaign",
          totalPromotions: { $sum: 1 },
          activePromotions: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$isActive", true] },
                    { $eq: ["$status", "accepted"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          uniquePromoters: { $addToSet: "$promoter" },
        },
      },
    ]),
    CampaignClickModel.aggregate([
      {
        $match: {
          campaign: { $in: campaignIds },
          ...(promoterId ? { promoter: toObjectId(promoterId) } : {}),
          ...buildDateMatch({ startDate, endDate, range }),
        },
      },
      {
        $group: {
          _id: null,
          totalClicks: { $sum: 1 },
          billableClicks: {
            $sum: { $cond: [{ $eq: ["$status", "billable"] }, 1, 0] },
          },
          invalidClicks: {
            $sum: { $cond: [{ $eq: ["$status", "invalid"] }, 1, 0] },
          },
          duplicateClicks: {
            $sum: { $cond: [{ $eq: ["$status", "duplicate"] }, 1, 0] },
          },
          spend: {
            $sum: { $cond: [{ $eq: ["$status", "billable"] }, "$cost", 0] },
          },
        },
      },
    ]),
    CampaignClickModel.aggregate([
      {
        $match: {
          campaign: { $in: campaignIds },
          ...(promoterId ? { promoter: toObjectId(promoterId) } : {}),
          ...buildDateMatch({ startDate, endDate, range }),
        },
      },
      {
        $group: {
          _id: {
            day: {
              $dateToString: { format: "%Y-%m-%d", date: "$clickedAt" },
            },
          },
          trackedVisits: { $sum: 1 },
          billableClicks: {
            $sum: { $cond: [{ $eq: ["$status", "billable"] }, 1, 0] },
          },
          invalidClicks: {
            $sum: { $cond: [{ $eq: ["$status", "invalid"] }, 1, 0] },
          },
          duplicateClicks: {
            $sum: { $cond: [{ $eq: ["$status", "duplicate"] }, 1, 0] },
          },
          spend: {
            $sum: { $cond: [{ $eq: ["$status", "billable"] }, "$cost", 0] },
          },
        },
      },
      { $sort: { "_id.day": 1 } },
    ]),
    CampaignClickModel.aggregate([
      {
        $match: {
          campaign: { $in: campaignIds },
          ...(promoterId ? { promoter: toObjectId(promoterId) } : {}),
          ...buildDateMatch({ startDate, endDate, range }),
        },
      },
      {
        $group: {
          _id: "$campaign",
          trackedVisits: { $sum: 1 },
          billableClicks: {
            $sum: { $cond: [{ $eq: ["$status", "billable"] }, 1, 0] },
          },
          invalidClicks: {
            $sum: { $cond: [{ $eq: ["$status", "invalid"] }, 1, 0] },
          },
          duplicateClicks: {
            $sum: { $cond: [{ $eq: ["$status", "duplicate"] }, 1, 0] },
          },
          spend: {
            $sum: { $cond: [{ $eq: ["$status", "billable"] }, "$cost", 0] },
          },
          lastClickAt: { $max: "$clickedAt" },
        },
      },
    ]),
    CampaignClickModel.aggregate([
      {
        $match: {
          campaign: { $in: campaignIds },
          ...(promoterId ? { promoter: toObjectId(promoterId) } : {}),
          ...buildDateMatch({ startDate, endDate, range }),
        },
      },
      {
        $group: {
          _id: "$promoter",
          trackedVisits: { $sum: 1 },
          billableClicks: {
            $sum: { $cond: [{ $eq: ["$status", "billable"] }, 1, 0] },
          },
          invalidClicks: {
            $sum: { $cond: [{ $eq: ["$status", "invalid"] }, 1, 0] },
          },
          duplicateClicks: {
            $sum: { $cond: [{ $eq: ["$status", "duplicate"] }, 1, 0] },
          },
          earnings: {
            $sum: { $cond: [{ $eq: ["$status", "billable"] }, "$cost", 0] },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "promoter",
        },
      },
      { $unwind: { path: "$promoter", preserveNullAndEmptyArrays: true } },
      { $sort: { billableClicks: -1, trackedVisits: -1 } },
    ]),
    CampaignClickModel.aggregate([
      {
        $match: {
          campaign: { $in: campaignIds },
          ...(promoterId ? { promoter: toObjectId(promoterId) } : {}),
          ...buildDateMatch({ startDate, endDate, range }),
        },
      },
      {
        $group: {
          _id: "$deviceType",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),
    CampaignClickModel.aggregate([
      {
        $match: {
          campaign: { $in: campaignIds },
          ...(promoterId ? { promoter: toObjectId(promoterId) } : {}),
          ...buildDateMatch({ startDate, endDate, range }),
        },
      },
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
  ]);

  const promotionSummaryMap = new Map(
    promotionSummaryRows.map((row) => [
      String(row._id),
      {
        totalPromotions: Number(row.totalPromotions || 0),
        activePromotions: Number(row.activePromotions || 0),
        uniquePromoters: Number((row.uniquePromoters || []).length || 0),
      },
    ])
  );

  const clickByCampaignMap = new Map(
    clickByCampaignRows.map((row) => [String(row._id), row])
  );

  const clickSummary = summarizeClicks(clickSummaryRows[0]);
  const remainingBudget = campaigns.reduce(
    (sum, campaign) => sum + Math.max(Number(campaign.budget || 0) - Number(campaign.spentBudget || 0), 0),
    0
  );

  const summary = {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter((campaign) => campaign.status === "active").length,
    activePromotions: promotionSummaryRows.reduce((sum, row) => sum + Number(row.activePromotions || 0), 0),
    activePromoters: new Set(
      promotionSummaryRows.flatMap((row) => (row.uniquePromoters || []).map((id) => String(id)))
    ).size,
    remainingBudget: round(remainingBudget),
    ...clickSummary,
  };

  const campaignBreakdown = campaigns.map((campaign) => {
    const clickRow = clickByCampaignMap.get(String(campaign._id)) || {};
    const promotionRow = promotionSummaryMap.get(String(campaign._id)) || {
      totalPromotions: 0,
      activePromotions: 0,
      uniquePromoters: 0,
    };

    return {
      campaignId: campaign._id,
      title: campaign.title,
      status: campaign.status,
      budget: Number(campaign.budget || 0),
      spentBudget: round(campaign.spentBudget),
      remainingBudget: round(Math.max(Number(campaign.budget || 0) - Number(campaign.spentBudget || 0), 0)),
      trackedVisits: Number(clickRow.trackedVisits || 0),
      billableClicks: Number(clickRow.billableClicks || 0),
      invalidClicks: Number(clickRow.invalidClicks || 0),
      duplicateClicks: Number(clickRow.duplicateClicks || 0),
      spend: round(clickRow.spend),
      activePromotions: promotionRow.activePromotions,
      totalPromotions: promotionRow.totalPromotions,
      uniquePromoters: promotionRow.uniquePromoters,
      lastClickAt: clickRow.lastClickAt || campaign.updatedAt || campaign.createdAt,
    };
  });

  return {
    summary,
    timeSeries: timeSeriesRows.map((row) => ({
      date: row._id.day,
      trackedVisits: Number(row.trackedVisits || 0),
      billableClicks: Number(row.billableClicks || 0),
      invalidClicks: Number(row.invalidClicks || 0),
      duplicateClicks: Number(row.duplicateClicks || 0),
      spend: round(row.spend),
    })),
    campaignBreakdown,
    promoterBreakdown: clickByPromoterRows.map((row) => ({
      promoterId: row._id,
      displayName: row.promoter?.displayName || row.promoter?.username || "Promoter",
      username: row.promoter?.username || "",
      avatar: row.promoter?.avatar || "",
      trackedVisits: Number(row.trackedVisits || 0),
      billableClicks: Number(row.billableClicks || 0),
      invalidClicks: Number(row.invalidClicks || 0),
      duplicateClicks: Number(row.duplicateClicks || 0),
      earnings: round(row.earnings),
    })),
    deviceBreakdown: deviceRows.map((row) => ({
      deviceType: row._id || "unknown",
      count: Number(row.count || 0),
    })),
    sourceBreakdown: sourceRows.map((row) => ({
      source: normalizeSource(row._id),
      count: Number(row.count || 0),
    })),
  };
};

export const getPromoterAnalyticsSnapshot = async ({
  promoterId,
  campaignId = null,
  startDate,
  endDate,
  range,
}) => {
  const promotionQuery = {
    promoter: toObjectId(promoterId),
  };

  const promotions = await PromotionModel.find(promotionQuery)
    .select("_id campaign status isActive upi acceptedAt clickStats payoutAmount createdAt updatedAt")
    .populate("campaign", "_id title status budget spentBudget costPerClick currency")
    .sort({ createdAt: -1 })
    .lean();

  const eligiblePromotions = campaignId
    ? promotions.filter((promotion) => String(promotion.campaign?._id || "") === String(campaignId))
    : promotions;

  const promotionIds = eligiblePromotions.map((promotion) => promotion._id);
  if (!promotionIds.length) {
    return {
      summary: {
        totalPromotions: 0,
        activePromotions: 0,
        linkedCampaigns: 0,
        trackedVisits: 0,
        billableClicks: 0,
        invalidClicks: 0,
        duplicateClicks: 0,
        earnings: 0,
        qualityRate: 0,
        averageEarningPerBillableClick: 0,
      },
      timeSeries: [],
      promotionBreakdown: [],
      campaignBreakdown: [],
      deviceBreakdown: [],
      sourceBreakdown: [],
    };
  }

  const campaignIds = [...new Set(eligiblePromotions.map((promotion) => String(promotion.campaign?._id || "")))]
    .filter(Boolean)
    .map((id) => toObjectId(id));

  const [clickSummaryRows, timeSeriesRows, clickByPromotionRows, clickByCampaignRows, deviceRows, sourceRows] = await Promise.all([
    CampaignClickModel.aggregate([
      {
        $match: {
          promotion: { $in: promotionIds },
          promoter: toObjectId(promoterId),
          ...buildDateMatch({ startDate, endDate, range }),
        },
      },
      {
        $group: {
          _id: null,
          totalClicks: { $sum: 1 },
          billableClicks: {
            $sum: { $cond: [{ $eq: ["$status", "billable"] }, 1, 0] },
          },
          invalidClicks: {
            $sum: { $cond: [{ $eq: ["$status", "invalid"] }, 1, 0] },
          },
          duplicateClicks: {
            $sum: { $cond: [{ $eq: ["$status", "duplicate"] }, 1, 0] },
          },
          earnings: {
            $sum: { $cond: [{ $eq: ["$status", "billable"] }, "$cost", 0] },
          },
        },
      },
    ]),
    CampaignClickModel.aggregate([
      {
        $match: {
          promotion: { $in: promotionIds },
          promoter: toObjectId(promoterId),
          ...buildDateMatch({ startDate, endDate, range }),
        },
      },
      {
        $group: {
          _id: {
            day: {
              $dateToString: { format: "%Y-%m-%d", date: "$clickedAt" },
            },
          },
          trackedVisits: { $sum: 1 },
          billableClicks: {
            $sum: { $cond: [{ $eq: ["$status", "billable"] }, 1, 0] },
          },
          invalidClicks: {
            $sum: { $cond: [{ $eq: ["$status", "invalid"] }, 1, 0] },
          },
          duplicateClicks: {
            $sum: { $cond: [{ $eq: ["$status", "duplicate"] }, 1, 0] },
          },
          earnings: {
            $sum: { $cond: [{ $eq: ["$status", "billable"] }, "$cost", 0] },
          },
        },
      },
      { $sort: { "_id.day": 1 } },
    ]),
    CampaignClickModel.aggregate([
      {
        $match: {
          promotion: { $in: promotionIds },
          promoter: toObjectId(promoterId),
          ...buildDateMatch({ startDate, endDate, range }),
        },
      },
      {
        $group: {
          _id: "$promotion",
          trackedVisits: { $sum: 1 },
          billableClicks: {
            $sum: { $cond: [{ $eq: ["$status", "billable"] }, 1, 0] },
          },
          invalidClicks: {
            $sum: { $cond: [{ $eq: ["$status", "invalid"] }, 1, 0] },
          },
          duplicateClicks: {
            $sum: { $cond: [{ $eq: ["$status", "duplicate"] }, 1, 0] },
          },
          earnings: {
            $sum: { $cond: [{ $eq: ["$status", "billable"] }, "$cost", 0] },
          },
          lastClickAt: { $max: "$clickedAt" },
        },
      },
    ]),
    CampaignClickModel.aggregate([
      {
        $match: {
          campaign: { $in: campaignIds },
          promoter: toObjectId(promoterId),
          ...buildDateMatch({ startDate, endDate, range }),
        },
      },
      {
        $group: {
          _id: "$campaign",
          trackedVisits: { $sum: 1 },
          billableClicks: {
            $sum: { $cond: [{ $eq: ["$status", "billable"] }, 1, 0] },
          },
          invalidClicks: {
            $sum: { $cond: [{ $eq: ["$status", "invalid"] }, 1, 0] },
          },
          duplicateClicks: {
            $sum: { $cond: [{ $eq: ["$status", "duplicate"] }, 1, 0] },
          },
          earnings: {
            $sum: { $cond: [{ $eq: ["$status", "billable"] }, "$cost", 0] },
          },
        },
      },
    ]),
    CampaignClickModel.aggregate([
      {
        $match: {
          promotion: { $in: promotionIds },
          promoter: toObjectId(promoterId),
          ...buildDateMatch({ startDate, endDate, range }),
        },
      },
      {
        $group: {
          _id: "$deviceType",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),
    CampaignClickModel.aggregate([
      {
        $match: {
          promotion: { $in: promotionIds },
          promoter: toObjectId(promoterId),
          ...buildDateMatch({ startDate, endDate, range }),
        },
      },
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
  ]);

  const clickSummary = summarizeClicks(clickSummaryRows[0]);
  const promotionClickMap = new Map(clickByPromotionRows.map((row) => [String(row._id), row]));
  const campaignClickMap = new Map(clickByCampaignRows.map((row) => [String(row._id), row]));

  const summary = {
    trackedVisits: clickSummary.trackedVisits,
    billableClicks: clickSummary.billableClicks,
    invalidClicks: clickSummary.invalidClicks,
    duplicateClicks: clickSummary.duplicateClicks,
    totalPromotions: eligiblePromotions.length,
    activePromotions: eligiblePromotions.filter((promotion) => promotion.status === "accepted" && promotion.isActive !== false).length,
    linkedCampaigns: new Set(eligiblePromotions.map((promotion) => String(promotion.campaign?._id || ""))).size,
    earnings: round(clickSummaryRows[0]?.earnings || 0),
    qualityRate: clickSummary.qualityRate,
    averageEarningPerBillableClick: Number(clickSummary.billableClicks) > 0
      ? round(Number(clickSummaryRows[0]?.earnings || 0) / Number(clickSummary.billableClicks || 1))
      : 0,
  };

  const campaignBreakdown = Array.from(
    eligiblePromotions.reduce((entries, promotion) => {
      const campaign = promotion.campaign;
      if (!campaign) return entries;

      const existing = entries.get(String(campaign._id));
      const clickRow = campaignClickMap.get(String(campaign._id)) || {};
      if (existing) {
        return entries;
      }

      entries.set(String(campaign._id), {
        campaignId: campaign._id,
        title: campaign.title,
        status: campaign.status,
        trackedVisits: Number(clickRow.trackedVisits || 0),
        billableClicks: Number(clickRow.billableClicks || 0),
        invalidClicks: Number(clickRow.invalidClicks || 0),
        duplicateClicks: Number(clickRow.duplicateClicks || 0),
        earnings: round(clickRow.earnings),
      });

      return entries;
    }, new Map()).values()
  );

  return {
    summary,
    timeSeries: timeSeriesRows.map((row) => ({
      date: row._id.day,
      trackedVisits: Number(row.trackedVisits || 0),
      billableClicks: Number(row.billableClicks || 0),
      invalidClicks: Number(row.invalidClicks || 0),
      duplicateClicks: Number(row.duplicateClicks || 0),
      earnings: round(row.earnings),
    })),
    promotionBreakdown: eligiblePromotions.map((promotion) => {
      const clickRow = promotionClickMap.get(String(promotion._id)) || {};
      return {
        promotionId: promotion._id,
        campaignId: promotion.campaign?._id || null,
        title: promotion.campaign?.title || "Campaign",
        status: promotion.status,
        isActive: promotion.isActive !== false,
        upi: promotion.upi || "",
        trackedVisits: Number(clickRow.trackedVisits || 0),
        billableClicks: Number(clickRow.billableClicks || 0),
        invalidClicks: Number(clickRow.invalidClicks || 0),
        duplicateClicks: Number(clickRow.duplicateClicks || 0),
        earnings: round(clickRow.earnings),
        lastClickAt: clickRow.lastClickAt || promotion.updatedAt || promotion.createdAt,
      };
    }),
    campaignBreakdown,
    deviceBreakdown: deviceRows.map((row) => ({
      deviceType: row._id || "unknown",
      count: Number(row.count || 0),
    })),
    sourceBreakdown: sourceRows.map((row) => ({
      source: normalizeSource(row._id),
      count: Number(row.count || 0),
    })),
  };
};
