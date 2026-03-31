import mongoose from "mongoose";
import { DEFAULTS } from "./store-analytics.constants.js";

const storeAnalyticsSchema = new mongoose.Schema({
  store: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Store', 
    required: true,
    index: true,
    unique: true
  },
  dailyViews: [{
    date: { 
      type: Date, 
      required: true,
      default: Date.now 
    },
    views: { 
      type: Number, 
      default: 0,
      min: 0 
    },
    uniqueVisitors: { 
      type: Number, 
      default: 0,
      min: 0 
    },
    promoterTraffic: { 
      type: Number, 
      default: 0,
      min: 0 
    }
  }],
  salesData: {
    totalRevenue: { 
      type: Number, 
      default: DEFAULTS.SALES_DATA.totalRevenue,
      min: 0 
    },
    promoterDrivenSales: { 
      type: Number, 
      default: DEFAULTS.SALES_DATA.promoterDrivenSales,
      min: 0 
    },
    conversionRate: { 
      type: Number, 
      default: DEFAULTS.SALES_DATA.conversionRate,
      min: 0,
      max: 100 
    },
    topProducts: [{
      product: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Product",
        required: true 
      },
      sales: { 
        type: Number, 
        default: 0,
        min: 0 
      },
      revenue: { 
        type: Number, 
        default: 0,
        min: 0 
      }
    }]
  },
  promoterPerformance: [{
    promoter: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      required: true 
    },
    clicks: { 
      type: Number, 
      default: 0,
      min: 0 
    },
    conversions: { 
      type: Number, 
      default: 0,
      min: 0 
    },
    commissionEarned: { 
      type: Number, 
      default: 0,
      min: 0 
    },
    lastActivity: {
      type: Date,
      default: Date.now
    }
  }],
  // Metadata for analytics
  lastCalculated: {
    type: Date,
    default: Date.now
  },
  metadata: {
    totalProducts: { type: Number, default: 0 },
    activePromoters: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export default storeAnalyticsSchema;