import mongoose from "mongoose";
import { ORDER_STATUS, PAYMENT_STATUS } from "./order.constants.js";

export const setupOrderStatics = (schema) => {
  // Generate unique order number
  schema.statics.generateOrderNumber = async function() {
    const prefix = 'ORD';
    const date = new Date();
    const dateStr = date.getFullYear().toString().slice(-2) +
                    (date.getMonth() + 1).toString().padStart(2, '0') +
                    date.getDate().toString().padStart(2, '0');
    
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const orderNumber = `${prefix}-${dateStr}-${random}`;
    
    // Check uniqueness
    const existing = await this.findOne({ orderNumber });
    if (existing) {
      return this.generateOrderNumber(); // Recursive retry
    }
    
    return orderNumber;
  };

  // Find orders by customer
  schema.statics.findByCustomer = async function(customerId, options = {}) {
    const { limit = 20, skip = 0, status = null } = options;
    
    const query = { customer: customerId, isDeleted: false };
    if (status) query.orderStatus = status;
    
    const orders = await this.find(query)
      .populate('store', 'name logo')
      .populate('items.product', 'name images')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
    
    const total = await this.countDocuments(query);
    
    return {
      orders,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + orders.length < total
      }
    };
  };

  // Find orders by store
  schema.statics.findByStore = async function(storeId, options = {}) {
    const { limit = 20, skip = 0, status = null, startDate = null, endDate = null } = options;
    
    const query = { store: storeId, isDeleted: false };
    if (status) query.orderStatus = status;
    if (startDate || endDate) {
      query.placedAt = {};
      if (startDate) query.placedAt.$gte = new Date(startDate);
      if (endDate) query.placedAt.$lte = new Date(endDate);
    }
    
    const orders = await this.find(query)
      .populate('customer', 'username displayName email')
      .populate('items.product', 'name price images')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
    
    const total = await this.countDocuments(query);
    
    // Calculate store stats
    const stats = await this.aggregate([
      { $match: { store: new mongoose.Types.ObjectId(storeId), isDeleted: false } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: '$totalAmount' },
          totalCommission: { $sum: '$totalPromoterCommission' }
        }
      }
    ]);
    
    return {
      orders,
      stats: stats[0] || {
        totalRevenue: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        totalCommission: 0
      },
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + orders.length < total
      }
    };
  };

  // Find orders by promoter
  schema.statics.findByPromoter = async function(promoterId, options = {}) {
    const { limit = 20, skip = 0, commissionPaid = null } = options;
    
    const query = { 
      'items.promoterId': promoterId,
      isDeleted: false 
    };
    
    if (commissionPaid !== null) {
      query.commissionPaid = commissionPaid;
    }
    
    const orders = await this.find(query)
      .populate('store', 'name logo')
      .populate('customer', 'username displayName')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
    
    // Calculate promoter earnings
    const earnings = await this.aggregate([
      { $match: { 'items.promoterId': new mongoose.Types.ObjectId(promoterId) } },
      { $unwind: '$items' },
      { $match: { 'items.promoterId': new mongoose.Types.ObjectId(promoterId) } },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$items.commissionEarned' },
          totalOrders: { $sum: 1 },
          paidEarnings: { 
            $sum: { 
              $cond: ['$commissionPaid', '$items.commissionEarned', 0] 
            } 
          },
          pendingEarnings: { 
            $sum: { 
              $cond: ['$commissionPaid', 0, '$items.commissionEarned'] 
            } 
          }
        }
      }
    ]);
    
    const total = await this.countDocuments(query);
    
    return {
      orders,
      earnings: earnings[0] || {
        totalEarnings: 0,
        totalOrders: 0,
        paidEarnings: 0,
        pendingEarnings: 0
      },
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + orders.length < total
      }
    };
  };

  // Get sales analytics
  schema.statics.getSalesAnalytics = async function(storeId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const analytics = await this.aggregate([
      { 
        $match: { 
          store: new mongoose.Types.ObjectId(storeId),
          placedAt: { $gte: startDate },
          paymentStatus: PAYMENT_STATUS.PAID,
          isDeleted: false
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: '$placedAt' },
            month: { $month: '$placedAt' },
            day: { $dayOfMonth: '$placedAt' }
          },
          totalRevenue: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
          totalCommission: { $sum: '$totalPromoterCommission' },
          averageOrderValue: { $avg: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);
    
    // Calculate promoter-driven vs organic
    const promoterDriven = await this.aggregate([
      { 
        $match: { 
          store: new mongoose.Types.ObjectId(storeId),
          placedAt: { $gte: startDate },
          paymentStatus: PAYMENT_STATUS.PAID,
          isDeleted: false,
          totalPromoterCommission: { $gt: 0 }
        } 
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
          commission: { $sum: '$totalPromoterCommission' }
        }
      }
    ]);
    
    return {
      daily: analytics,
      promoterDriven: promoterDriven[0] || { revenue: 0, orders: 0, commission: 0 },
      organic: {
        revenue: (analytics.reduce((sum, day) => sum + day.totalRevenue, 0) || 0) - (promoterDriven[0]?.revenue || 0),
        orders: (analytics.reduce((sum, day) => sum + day.totalOrders, 0) || 0) - (promoterDriven[0]?.orders || 0)
      }
    };
  };

  // Get order statistics
  schema.statics.getStats = async function(query = {}) {
    const stats = await this.aggregate([
      { $match: { ...query, isDeleted: false } },
      {
        $group: {
          _id: '$orderStatus',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalCommission: { $sum: '$totalPromoterCommission' }
        }
      }
    ]);
    
    const total = await this.countDocuments({ ...query, isDeleted: false });
    const totalRevenue = await this.aggregate([
      { $match: { ...query, isDeleted: false, paymentStatus: PAYMENT_STATUS.PAID } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    return {
      total,
      totalRevenue: totalRevenue[0]?.total || 0,
      byStatus: stats
    };
  };
};