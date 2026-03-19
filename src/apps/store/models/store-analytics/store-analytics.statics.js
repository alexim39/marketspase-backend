import mongoose from "mongoose";
import { DATE_RANGE, ERROR_MESSAGES } from "./store-analytics.constants.js";
import { comparePeriods } from "./store-analytics.utils.js";

export const setupStoreAnalyticsStatics = (schema) => {
  // Find or create analytics for a store
  schema.statics.findOrCreate = async function(storeId) {
    let analytics = await this.findOne({ store: storeId });
    
    if (!analytics) {
      analytics = await this.create({
        store: storeId,
        dailyViews: [],
        salesData: {
          totalRevenue: 0,
          promoterDrivenSales: 0,
          conversionRate: 0,
          topProducts: []
        },
        promoterPerformance: []
      });
    }
    
    return analytics;
  };

  // Get analytics for date range
  schema.statics.getForDateRange = async function(storeId, range = DATE_RANGE.LAST_30_DAYS, customStart = null, customEnd = null) {
    const analytics = await this.findOne({ store: storeId })
      .populate('salesData.topProducts.product', 'name price images')
      .populate('promoterPerformance.promoter', 'username displayName avatar');
    
    if (!analytics) {
      return null;
    }
    
    let startDate, endDate = new Date();
    
    switch(range) {
      case DATE_RANGE.TODAY:
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case DATE_RANGE.YESTERDAY:
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case DATE_RANGE.LAST_7_DAYS:
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case DATE_RANGE.LAST_30_DAYS:
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        break;
      case DATE_RANGE.THIS_MONTH:
        startDate = new Date();
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case DATE_RANGE.LAST_MONTH:
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setDate(0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case DATE_RANGE.THIS_YEAR:
        startDate = new Date();
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case DATE_RANGE.CUSTOM:
        if (!customStart || !customEnd) {
          throw new Error(ERROR_MESSAGES.INVALID_DATE_RANGE);
        }
        startDate = new Date(customStart);
        endDate = new Date(customEnd);
        break;
      default:
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
    }
    
    const filteredDailyViews = analytics.dailyViews.filter(
      day => day.date >= startDate && day.date <= endDate
    );
    
    const result = analytics.toObject();
    result.dailyViews = filteredDailyViews;
    
    return result;
  };

  // Get top performing stores
  schema.statics.getTopStores = async function(metric = 'revenue', limit = 10) {
    let sortField = 'salesData.totalRevenue';
    
    switch(metric) {
      case 'views':
        sortField = 'dailyViews.views';
        break;
      case 'conversions':
        sortField = 'salesData.promoterDrivenSales';
        break;
      case 'commission':
        sortField = 'promoterPerformance.commissionEarned';
        break;
    }
    
    const stores = await this.aggregate([
      {
        $addFields: {
          totalViews: { $sum: '$dailyViews.views' },
          totalRevenue: '$salesData.totalRevenue',
          totalConversions: '$salesData.promoterDrivenSales'
        }
      },
      { $sort: { [sortField]: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'stores',
          localField: 'store',
          foreignField: '_id',
          as: 'storeInfo'
        }
      },
      { $unwind: '$storeInfo' },
      {
        $project: {
          store: '$storeInfo',
          totalViews: 1,
          totalRevenue: 1,
          totalConversions: 1,
          conversionRate: '$salesData.conversionRate',
          promoterCount: { $size: '$promoterPerformance' }
        }
      }
    ]);
    
    return stores;
  };

  // Get analytics summary for multiple stores
  schema.statics.getSummaryForStores = async function(storeIds) {
    const analytics = await this.find({ store: { $in: storeIds } })
      .populate('store', 'name logo')
      .lean();
    
    return analytics.map(a => ({
      store: a.store,
      totalViews: a.dailyViews?.reduce((sum, day) => sum + day.views, 0) || 0,
      totalRevenue: a.salesData?.totalRevenue || 0,
      conversionRate: a.salesData?.conversionRate || 0,
      activePromoters: a.promoterPerformance?.length || 0
    }));
  };

  // Aggregate analytics across all stores
  schema.statics.getPlatformAnalytics = async function() {
    const results = await this.aggregate([
      {
        $group: {
          _id: null,
          totalStores: { $sum: 1 },
          totalRevenue: { $sum: '$salesData.totalRevenue' },
          totalPromoterDrivenSales: { $sum: '$salesData.promoterDrivenSales' },
          totalPromoters: { $sum: { $size: '$promoterPerformance' } },
          averageConversionRate: { $avg: '$salesData.conversionRate' },
          totalViews: { $sum: { $sum: '$dailyViews.views' } }
        }
      }
    ]);
    
    return results[0] || {
      totalStores: 0,
      totalRevenue: 0,
      totalPromoterDrivenSales: 0,
      totalPromoters: 0,
      averageConversionRate: 0,
      totalViews: 0
    };
  };

  // Get stores needing attention (low performance)
  schema.statics.getStoresNeedingAttention = async function() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const stores = await this.aggregate([
      {
        $match: {
          'dailyViews.date': { $gte: thirtyDaysAgo }
        }
      },
      {
        $addFields: {
          recentViews: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$dailyViews',
                    as: 'day',
                    cond: { $gte: ['$$day.date', thirtyDaysAgo] }
                  }
                },
                as: 'day',
                in: '$$day.views'
              }
            }
          }
        }
      },
      {
        $match: {
          $or: [
            { recentViews: { $lt: 100 } },
            { 'salesData.conversionRate': { $lt: 1 } }
          ]
        }
      },
      {
        $lookup: {
          from: 'stores',
          localField: 'store',
          foreignField: '_id',
          as: 'storeInfo'
        }
      },
      { $unwind: '$storeInfo' },
      {
        $project: {
          store: '$storeInfo',
          recentViews: 1,
          conversionRate: '$salesData.conversionRate',
          totalRevenue: '$salesData.totalRevenue'
        }
      }
    ]);
    
    return stores;
  };
};