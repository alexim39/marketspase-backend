import mongoose from "mongoose";

export const setupTransactionStatics = (schema) => {
  // Find transactions by reference
  schema.statics.findByReference = function(reference) {
    return this.findOne({ reference });
  };

  // Find transactions by user (via related models)
  schema.statics.findByUser = async function(userId, options = {}) {
    const { limit = 50, skip = 0, sort = { createdAt: -1 } } = options;
    
    // This is a complex query that might need to be adjusted based on your data model
    // You might need to join with Campaign, Promotion, etc.
    return this.find({
      $or: [
        { relatedCampaign: { $in: await this.getUserCampaigns(userId) } },
        { relatedPromotion: { $in: await this.getUserPromotions(userId) } }
      ]
    })
    .limit(limit)
    .skip(skip)
    .sort(sort);
  };

  // Get transaction statistics
  schema.statics.getStats = async function(query = {}) {
    const stats = await this.aggregate([
      { $match: query },
      { $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalFee: { $sum: '$fee' },
        totalPayable: { $sum: '$amountPayable' }
      }},
      { $sort: { _id: 1 } }
    ]);
    
    const totals = await this.aggregate([
      { $match: query },
      { $group: {
        _id: null,
        totalCount: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalFee: { $sum: '$fee' },
        totalPayable: { $sum: '$amountPayable' }
      }}
    ]);

    return {
      byStatus: stats,
      totals: totals[0] || { totalCount: 0, totalAmount: 0, totalFee: 0, totalPayable: 0 }
    };
  };

  // Get daily transaction summary
  schema.statics.getDailySummary = async function(startDate, endDate) {
    const match = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    return this.aggregate([
      { $match: match },
      { $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          category: "$category",
          status: "$status"
        },
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
        totalFee: { $sum: "$fee" }
      }},
      { $sort: { "_id.date": -1 } }
    ]);
  };

  // Helper method to get user campaigns (might need to be implemented)
  schema.statics.getUserCampaigns = async function(userId) {
    // This should be implemented based on your Campaign model
    // For now, return empty array
    return [];
  };

  // Helper method to get user promotions (might need to be implemented)
  schema.statics.getUserPromotions = async function(userId) {
    // This should be implemented based on your Promotion model
    // For now, return empty array
    return [];
  };
};