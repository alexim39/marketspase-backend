import { 
  calculateAverageDailyViews, 
  calculateTotalCommission,
  getTopPerformers 
} from "./store-analytics.utils.js";

export const setupStoreAnalyticsVirtuals = (schema) => {
  // Virtual for average daily views
  schema.virtual('averageDailyViews').get(function() {
    return calculateAverageDailyViews(this.dailyViews, 30);
  });

  // Virtual for total commission paid
  schema.virtual('totalCommissionPaid').get(function() {
    return calculateTotalCommission(this.promoterPerformance);
  });

  // Virtual for top performing promoters
  schema.virtual('topPerformers').get(function() {
    return getTopPerformers(this.promoterPerformance, 5);
  });

  // Virtual for total views all time
  schema.virtual('totalViewsAllTime').get(function() {
    return this.dailyViews?.reduce((sum, day) => sum + day.views, 0) || 0;
  });

  // Virtual for total unique visitors
  schema.virtual('totalUniqueVisitors').get(function() {
    return this.dailyViews?.reduce((sum, day) => sum + day.uniqueVisitors, 0) || 0;
  });

  // Virtual for promoter traffic percentage
  schema.virtual('promoterTrafficPercentage').get(function() {
    const totalViews = this.totalViewsAllTime;
    const promoterTraffic = this.dailyViews?.reduce((sum, day) => sum + day.promoterTraffic, 0) || 0;
    
    return totalViews > 0 ? (promoterTraffic / totalViews) * 100 : 0;
  });

  // Virtual for average conversion rate
  schema.virtual('averageConversionRate').get(function() {
    return this.salesData?.conversionRate || 0;
  });

  // Virtual for revenue per view
  schema.virtual('revenuePerView').get(function() {
    const totalViews = this.totalViewsAllTime;
    const totalRevenue = this.salesData?.totalRevenue || 0;
    
    return totalViews > 0 ? totalRevenue / totalViews : 0;
  });

  // Virtual for active promoters count
  schema.virtual('activePromotersCount').get(function() {
    return this.promoterPerformance?.filter(p => p.clicks > 0 || p.conversions > 0).length || 0;
  });

  // Virtual for top product
  schema.virtual('topProduct').get(function() {
    if (!this.salesData?.topProducts || this.salesData.topProducts.length === 0) return null;
    
    return this.salesData.topProducts
      .sort((a, b) => b.sales - a.sales)[0];
  });

  // Virtual for today's stats
  schema.virtual('todayStats').get(function() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayData = this.dailyViews?.find(
      day => new Date(day.date).setHours(0, 0, 0, 0) === today.getTime()
    );
    
    return todayData || {
      views: 0,
      uniqueVisitors: 0,
      promoterTraffic: 0
    };
  });

  // Virtual for weekly stats
  schema.virtual('weeklyStats').get(function() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const weeklyData = this.dailyViews?.filter(
      day => new Date(day.date) >= oneWeekAgo
    ) || [];
    
    return {
      views: weeklyData.reduce((sum, day) => sum + day.views, 0),
      uniqueVisitors: weeklyData.reduce((sum, day) => sum + day.uniqueVisitors, 0),
      promoterTraffic: weeklyData.reduce((sum, day) => sum + day.promoterTraffic, 0),
      days: weeklyData.length
    };
  });

  // Virtual for monthly stats
  schema.virtual('monthlyStats').get(function() {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const monthlyData = this.dailyViews?.filter(
      day => new Date(day.date) >= oneMonthAgo
    ) || [];
    
    return {
      views: monthlyData.reduce((sum, day) => sum + day.views, 0),
      uniqueVisitors: monthlyData.reduce((sum, day) => sum + day.uniqueVisitors, 0),
      promoterTraffic: monthlyData.reduce((sum, day) => sum + day.promoterTraffic, 0),
      days: monthlyData.length
    };
  });
};