import mongoose from "mongoose";
import { calculateConversionRate } from "./store-analytics.utils.js";

export const setupStoreAnalyticsMiddleware = (schema) => {
  // Pre-save middleware
  schema.pre('save', function(next) {
    // Sort daily views by date
    if (this.dailyViews && this.dailyViews.length > 0) {
      this.dailyViews.sort((a, b) => a.date - b.date);
    }
    
    // Sort promoter performance by commission earned
    if (this.promoterPerformance && this.promoterPerformance.length > 0) {
      this.promoterPerformance.sort((a, b) => b.commissionEarned - a.commissionEarned);
    }
    
    // Sort top products by sales
    if (this.salesData?.topProducts && this.salesData.topProducts.length > 0) {
      this.salesData.topProducts.sort((a, b) => b.sales - a.sales);
    }
    
    // Calculate conversion rate if not set
    if (this.isModified('dailyViews') || this.isModified('salesData.promoterDrivenSales')) {
      const totalViews = this.dailyViews?.reduce((sum, day) => sum + day.views, 0) || 0;
      const totalConversions = this.salesData?.promoterDrivenSales || 0;
      
      if (totalViews > 0) {
        this.salesData.conversionRate = calculateConversionRate(totalViews, totalConversions);
      }
    }
    
    // Update metadata
    this.metadata = {
      ...this.metadata,
      totalProducts: this.salesData?.topProducts?.length || 0,
      activePromoters: this.promoterPerformance?.filter(p => p.clicks > 0).length || 0,
      averageOrderValue: this.salesData?.totalRevenue > 0 && this.salesData?.promoterDrivenSales > 0 
        ? this.salesData.totalRevenue / this.salesData.promoterDrivenSales 
        : 0
    };
    
    this.lastCalculated = new Date();
    next();
  });

  // Pre-update middleware
  schema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    
    // Recalculate conversion rate if relevant fields are updated
    if (update.dailyViews || update['salesData.promoterDrivenSales']) {
      // This would need to fetch the document to calculate properly
      // For now, we'll handle it in the service layer
    }
    
    next();
  });

  // Post-find middleware to populate references
  schema.post(/^find/, async function(result) {
    if (!result) return;

    const populateFields = async (item) => {
      if (item && typeof item.populate === 'function') {
        // It's a document - use populate with array syntax (Mongoose 6+)
        await item.populate([
          { path: 'store', select: 'name logo owner' },
          { path: 'salesData.topProducts.product', select: 'name price images' },
          { path: 'promoterPerformance.promoter', select: 'username displayName avatar' }
        ]);
      }
    };

    if (Array.isArray(result)) {
      await Promise.all(result.map(item => populateFields(item)));
    } else {
      await populateFields(result);
    }
  });
};