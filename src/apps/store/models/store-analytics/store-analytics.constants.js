// Date Ranges for Analytics
export const DATE_RANGE = {
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  LAST_7_DAYS: 'last7days',
  LAST_30_DAYS: 'last30days',
  THIS_MONTH: 'thisMonth',
  LAST_MONTH: 'lastMonth',
  THIS_YEAR: 'thisYear',
  CUSTOM: 'custom'
};

// Metric Types
export const METRIC_TYPE = {
  VIEWS: 'views',
  UNIQUE_VISITORS: 'uniqueVisitors',
  PROMOTER_TRAFFIC: 'promoterTraffic',
  REVENUE: 'revenue',
  CONVERSIONS: 'conversions',
  COMMISSIONS: 'commissions'
};

// Default Values
export const DEFAULTS = {
  DAILY_VIEWS: [],
  SALES_DATA: {
    totalRevenue: 0,
    promoterDrivenSales: 0,
    conversionRate: 0,
    topProducts: []
  },
  PROMOTER_PERFORMANCE: []
};

// Thresholds
export const THRESHOLDS = {
  GOOD_CONVERSION_RATE: 5, // 5% conversion rate is good
  HIGH_PERFORMER_COMMISSION: 10000, // ₦10,000 commission threshold for high performers
  LOW_PERFORMER_VIEWS: 100 // Less than 100 views per day is low performance
};

// Error Messages
export const ERROR_MESSAGES = {
  STORE_REQUIRED: 'Store ID is required',
  ANALYTICS_NOT_FOUND: 'Store analytics not found',
  INVALID_DATE_RANGE: 'Invalid date range',
  NO_DATA_FOR_PERIOD: 'No analytics data available for the specified period',
  PRODUCT_NOT_FOUND: 'Product not found in analytics',
  PROMOTER_NOT_FOUND: 'Promoter not found in analytics'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  ANALYTICS_UPDATED: 'Store analytics updated successfully',
  DAILY_VIEWS_RECORDED: 'Daily views recorded successfully',
  SALES_DATA_UPDATED: 'Sales data updated successfully',
  PROMOTER_PERFORMANCE_UPDATED: 'Promoter performance updated successfully'
};

// Aggregation Pipeline Stages
export const AGGREGATION_STAGES = {
  GROUP_BY_DAY: {
    $group: {
      _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
      totalViews: { $sum: '$views' },
      totalUniqueVisitors: { $sum: '$uniqueVisitors' },
      totalPromoterTraffic: { $sum: '$promoterTraffic' }
    }
  }
};