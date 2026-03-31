import { calculateConversionRate } from "./store-analytics.utils.js";
import { ERROR_MESSAGES } from "./store-analytics.constants.js";

export const setupStoreAnalyticsMethods = (schema) => {
  // Record daily views
  schema.methods.recordDailyViews = async function(date, views, uniqueVisitors, promoterTraffic) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    let dailyView = this.dailyViews.find(
      d => new Date(d.date).setHours(0, 0, 0, 0) === targetDate.getTime()
    );
    
    if (dailyView) {
      // Update existing entry
      dailyView.views += views;
      dailyView.uniqueVisitors += uniqueVisitors;
      dailyView.promoterTraffic += promoterTraffic;
    } else {
      // Create new entry
      this.dailyViews.push({
        date: targetDate,
        views,
        uniqueVisitors,
        promoterTraffic
      });
    }
    
    // Keep only last 90 days of daily views to prevent unlimited growth
    if (this.dailyViews.length > 90) {
      this.dailyViews = this.dailyViews.sort((a, b) => b.date - a.date).slice(0, 90);
    }
    
    this.lastCalculated = new Date();
    await this.save();
    return this;
  };

  // Update sales data
  schema.methods.updateSalesData = async function(salesData) {
    this.salesData = {
      ...this.salesData,
      ...salesData
    };
    
    // Recalculate conversion rate if views data is available
    const totalViews = this.dailyViews?.reduce((sum, day) => sum + day.views, 0) || 0;
    if (totalViews > 0 && this.salesData.promoterDrivenSales > 0) {
      this.salesData.conversionRate = calculateConversionRate(
        totalViews,
        this.salesData.promoterDrivenSales
      );
    }
    
    this.lastCalculated = new Date();
    await this.save();
    return this;
  };

  // Update promoter performance
  schema.methods.updatePromoterPerformance = async function(promoterId, data) {
    let promoterPerf = this.promoterPerformance.find(
      p => p.promoter.toString() === promoterId.toString()
    );
    
    if (promoterPerf) {
      // Update existing
      promoterPerf.clicks += data.clicks || 0;
      promoterPerf.conversions += data.conversions || 0;
      promoterPerf.commissionEarned += data.commissionEarned || 0;
      promoterPerf.lastActivity = new Date();
    } else {
      // Create new
      this.promoterPerformance.push({
        promoter: promoterId,
        clicks: data.clicks || 0,
        conversions: data.conversions || 0,
        commissionEarned: data.commissionEarned || 0,
        lastActivity: new Date()
      });
    }
    
    this.lastCalculated = new Date();
    await this.save();
    return this;
  };

  // Update product performance in top products
  schema.methods.updateProductPerformance = async function(productId, sales, revenue) {
    if (!this.salesData.topProducts) {
      this.salesData.topProducts = [];
    }
    
    let productPerf = this.salesData.topProducts.find(
      p => p.product.toString() === productId.toString()
    );
    
    if (productPerf) {
      productPerf.sales += sales;
      productPerf.revenue += revenue;
    } else {
      this.salesData.topProducts.push({
        product: productId,
        sales,
        revenue
      });
    }
    
    // Sort and keep top 10
    this.salesData.topProducts = this.salesData.topProducts
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);
    
    this.lastCalculated = new Date();
    await this.save();
    return this;
  };

  // Get promoter performance
  schema.methods.getPromoterPerformance = function(promoterId) {
    return this.promoterPerformance.find(
      p => p.promoter.toString() === promoterId.toString()
    ) || {
      clicks: 0,
      conversions: 0,
      commissionEarned: 0
    };
  };

  // Get product performance
  schema.methods.getProductPerformance = function(productId) {
    return this.salesData.topProducts?.find(
      p => p.product.toString() === productId.toString()
    ) || {
      sales: 0,
      revenue: 0
    };
  };

  // Get views for date range
  schema.methods.getViewsForDateRange = function(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return this.dailyViews.filter(
      day => day.date >= start && day.date <= end
    );
  };

  // Calculate period over period growth
  schema.methods.calculateGrowth = function(currentPeriodDays = 30, previousPeriodDays = 30) {
    const now = new Date();
    
    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - currentPeriodDays);
    
    const previousEnd = new Date(currentStart);
    previousEnd.setDate(previousEnd.getDate() - 1);
    
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - previousPeriodDays);
    
    const currentPeriod = this.getViewsForDateRange(currentStart, now);
    const previousPeriod = this.getViewsForDateRange(previousStart, previousEnd);
    
    const currentTotal = currentPeriod.reduce((sum, day) => sum + day.views, 0);
    const previousTotal = previousPeriod.reduce((sum, day) => sum + day.views, 0);
    
    return {
      current: currentTotal,
      previous: previousTotal,
      change: currentTotal - previousTotal,
      growthRate: previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0
    };
  };

  // Reset analytics for a new period (e.g., new month)
  schema.methods.resetForNewPeriod = async function() {
    // Archive old data or simply keep as is
    this.lastCalculated = new Date();
    await this.save();
    return this;
  };

  // Get formatted response
  schema.methods.toResponse = function() {
    const { formatAnalyticsResponse } = require('./store-analytics.utils.js');
    return formatAnalyticsResponse(this);
  };
};