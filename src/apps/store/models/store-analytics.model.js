import mongoose from "mongoose";

const storeAnalyticsSchema = {
  dailyViews: [{
    date: Date,
    views: Number,
    uniqueVisitors: Number,
    promoterTraffic: Number
  }],
  salesData: {
    totalRevenue: Number,
    promoterDrivenSales: Number,
    conversionRate: Number,
    topProducts: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      sales: Number,
      revenue: Number
    }]
  },
  promoterPerformance: [{
    promoter: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    clicks: Number,
    conversions: Number,
    commissionEarned: Number
  }]
};
export const StoreAnalyticsModel = mongoose.model("storeAnalytics", new mongoose.Schema(storeAnalyticsSchema));