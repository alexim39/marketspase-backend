import mongoose from "mongoose";
import { PAYMENT_STATUS } from "./payment.constants.js";

export const setupPaymentStatics = (schema) => {
  // Generate unique transaction reference
  schema.statics.generateTransactionReference = async function() {
    const prefix = 'TXN';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const reference = `${prefix}-${timestamp}-${random}`;
    
    // Check uniqueness
    const existing = await this.findOne({ transactionReference: reference });
    if (existing) {
      return this.generateTransactionReference();
    }
    
    return reference;
  };

  // Find payment by order
  schema.statics.findByOrder = async function(orderId) {
    return this.findOne({ order: orderId })
      .populate('store', 'name logo')
      .populate('customer', 'username displayName email');
  };

  // Find payments by customer
  schema.statics.findByCustomer = async function(customerId, options = {}) {
    const { limit = 20, skip = 0, status = null } = options;
    
    const query = { customer: customerId };
    if (status) query.status = status;
    
    const payments = await this.find(query)
      .populate('order', 'orderNumber totalAmount')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
    
    const total = await this.countDocuments(query);
    
    // Calculate customer payment stats
    const stats = await this.aggregate([
      { $match: { customer: new mongoose.Types.ObjectId(customerId), status: PAYMENT_STATUS.SUCCESS } },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$amount' },
          totalTransactions: { $sum: 1 },
          averagePayment: { $avg: '$amount' }
        }
      }
    ]);
    
    return {
      payments,
      stats: stats[0] || { totalSpent: 0, totalTransactions: 0, averagePayment: 0 },
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + payments.length < total
      }
    };
  };

  // Find payments by store
  schema.statics.findByStore = async function(storeId, options = {}) {
    const { limit = 20, skip = 0, startDate = null, endDate = null } = options;
    
    const query = { store: storeId };
    if (startDate || endDate) {
      query.initiatedAt = {};
      if (startDate) query.initiatedAt.$gte = new Date(startDate);
      if (endDate) query.initiatedAt.$lte = new Date(endDate);
    }
    
    const payments = await this.find(query)
      .populate('order', 'orderNumber totalAmount items')
      .populate('customer', 'username displayName')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
    
    // Calculate store revenue stats
    const revenue = await this.aggregate([
      { $match: { store: new mongoose.Types.ObjectId(storeId), status: PAYMENT_STATUS.SUCCESS } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalTransactions: { $sum: 1 },
          averageTransactionValue: { $avg: '$amount' }
        }
      }
    ]);
    
    const total = await this.countDocuments(query);
    
    return {
      payments,
      revenue: revenue[0] || { totalRevenue: 0, totalTransactions: 0, averageTransactionValue: 0 },
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + payments.length < total
      }
    };
  };

  // Get payment statistics
  schema.statics.getPaymentStats = async function(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const stats = await this.aggregate([
      { $match: { initiatedAt: { $gte: startDate } } },
      {
        $facet: {
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } }
          ],
          byGateway: [
            { $group: { _id: '$paymentGateway', count: { $sum: 1 }, total: { $sum: '$amount' } } }
          ],
          byChannel: [
            { $group: { _id: '$paymentChannel', count: { $sum: 1 }, total: { $sum: '$amount' } } }
          ],
          daily: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$initiatedAt' } },
                count: { $sum: 1 },
                total: { $sum: '$amount' }
              }
            },
            { $sort: { '_id': 1 } }
          ],
          overview: [
            {
              $group: {
                _id: null,
                totalTransactions: { $sum: 1 },
                totalVolume: { $sum: '$amount' },
                successfulTransactions: { 
                  $sum: { $cond: [{ $eq: ['$status', PAYMENT_STATUS.SUCCESS] }, 1, 0] } 
                },
                successfulVolume: { 
                  $sum: { $cond: [{ $eq: ['$status', PAYMENT_STATUS.SUCCESS] }, '$amount', 0] } 
                },
                failedTransactions: { 
                  $sum: { $cond: [{ $eq: ['$status', PAYMENT_STATUS.FAILED] }, 1, 0] } 
                },
                refundedAmount: { $sum: '$refundedAmount' }
              }
            }
          ]
        }
      }
    ]);
    
    return stats[0];
  };

  // Get pending webhook payments
  schema.statics.getPendingWebhookPayments = async function(hoursAgo = 1) {
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    
    return this.find({
      status: PAYMENT_STATUS.PENDING,
      webhookReceived: false,
      initiatedAt: { $lt: cutoffTime }
    }).populate('order', 'orderNumber totalAmount');
  };
};