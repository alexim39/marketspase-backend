import { THRESHOLDS } from "./store-analytics.constants.js";

/**
 * Calculate conversion rate
 * @param {number} views - Number of views
 * @param {number} conversions - Number of conversions
 * @returns {number} - Conversion rate percentage
 */
export const calculateConversionRate = (views, conversions) => {
  if (!views || views === 0) return 0;
  return (conversions / views) * 100;
};

/**
 * Calculate average daily views
 * @param {Array} dailyViews - Array of daily view objects
 * @param {number} days - Number of days to calculate
 * @returns {number} - Average daily views
 */
export const calculateAverageDailyViews = (dailyViews, days = 30) => {
  if (!dailyViews || dailyViews.length === 0) return 0;
  
  const recentViews = dailyViews.slice(-days);
  const total = recentViews.reduce((sum, day) => sum + day.views, 0);
  return total / recentViews.length;
};

/**
 * Get top performing promoters
 * @param {Array} promoterPerformance - Array of promoter performance objects
 * @param {number} limit - Number of top performers to return
 * @returns {Array} - Top performing promoters
 */
export const getTopPerformers = (promoterPerformance, limit = 10) => {
  if (!promoterPerformance || promoterPerformance.length === 0) return [];
  
  return [...promoterPerformance]
    .sort((a, b) => b.commissionEarned - a.commissionEarned)
    .slice(0, limit);
};

/**
 * Get low performing promoters
 * @param {Array} promoterPerformance - Array of promoter performance objects
 * @returns {Array} - Low performing promoters
 */
export const getLowPerformers = (promoterPerformance) => {
  if (!promoterPerformance || promoterPerformance.length === 0) return [];
  
  return promoterPerformance.filter(p => 
    p.clicks < THRESHOLDS.LOW_PERFORMER_VIEWS && 
    p.conversions === 0
  );
};

/**
 * Calculate total promoter commission
 * @param {Array} promoterPerformance - Array of promoter performance objects
 * @returns {number} - Total commission
 */
export const calculateTotalCommission = (promoterPerformance) => {
  if (!promoterPerformance || promoterPerformance.length === 0) return 0;
  
  return promoterPerformance.reduce((sum, p) => sum + (p.commissionEarned || 0), 0);
};

/**
 * Format analytics for response
 * @param {Object} analytics - Store analytics document
 * @returns {Object} - Formatted analytics
 */
export const formatAnalyticsResponse = (analytics) => {
  const analyticsObj = analytics.toObject ? analytics.toObject() : analytics;
  
  // Calculate summary statistics
  const totalViews = analyticsObj.dailyViews?.reduce((sum, day) => sum + day.views, 0) || 0;
  const totalUniqueVisitors = analyticsObj.dailyViews?.reduce((sum, day) => sum + day.uniqueVisitors, 0) || 0;
  const totalPromoterTraffic = analyticsObj.dailyViews?.reduce((sum, day) => sum + day.promoterTraffic, 0) || 0;
  
  // Calculate promoter contribution percentage
  const promoterContribution = totalViews > 0 ? (totalPromoterTraffic / totalViews) * 100 : 0;
  
  return {
    store: analyticsObj.store,
    period: {
      startDate: analyticsObj.dailyViews?.[0]?.date,
      endDate: analyticsObj.dailyViews?.[analyticsObj.dailyViews.length - 1]?.date,
      totalDays: analyticsObj.dailyViews?.length || 0
    },
    summary: {
      totalViews,
      totalUniqueVisitors,
      totalPromoterTraffic,
      promoterContribution,
      averageDailyViews: analyticsObj.dailyViews?.length > 0 
        ? totalViews / analyticsObj.dailyViews.length 
        : 0,
      promoterContributionRate: promoterContribution
    },
    sales: analyticsObj.salesData || {
      totalRevenue: 0,
      promoterDrivenSales: 0,
      conversionRate: 0,
      topProducts: []
    },
    promoterPerformance: analyticsObj.promoterPerformance || [],
    topPerformers: getTopPerformers(analyticsObj.promoterPerformance, 5),
    totalCommission: calculateTotalCommission(analyticsObj.promoterPerformance)
  };
};

/**
 * Aggregate daily views by month
 * @param {Array} dailyViews - Array of daily view objects
 * @returns {Object} - Monthly aggregated views
 */
export const aggregateByMonth = (dailyViews) => {
  if (!dailyViews || dailyViews.length === 0) return {};
  
  const monthly = {};
  
  dailyViews.forEach(day => {
    const date = new Date(day.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthly[monthKey]) {
      monthly[monthKey] = {
        views: 0,
        uniqueVisitors: 0,
        promoterTraffic: 0,
        days: 0
      };
    }
    
    monthly[monthKey].views += day.views;
    monthly[monthKey].uniqueVisitors += day.uniqueVisitors;
    monthly[monthKey].promoterTraffic += day.promoterTraffic;
    monthly[monthKey].days += 1;
  });
  
  return monthly;
};

/**
 * Get growth rate
 * @param {number} current - Current value
 * @param {number} previous - Previous value
 * @returns {number} - Growth rate percentage
 */
export const getGrowthRate = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

/**
 * Compare two periods
 * @param {Array} currentPeriod - Current period daily views
 * @param {Array} previousPeriod - Previous period daily views
 * @returns {Object} - Comparison results
 */
export const comparePeriods = (currentPeriod, previousPeriod) => {
  const currentTotal = currentPeriod.reduce((sum, day) => sum + day.views, 0);
  const previousTotal = previousPeriod.reduce((sum, day) => sum + day.views, 0);
  
  return {
    current: currentTotal,
    previous: previousTotal,
    change: currentTotal - previousTotal,
    growthRate: getGrowthRate(currentTotal, previousTotal)
  };
};