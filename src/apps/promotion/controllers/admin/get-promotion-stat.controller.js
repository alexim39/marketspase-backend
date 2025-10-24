import { PromotionModel } from "../../../promotion/models/promotion.model.js";


/**
 * @desc    Get promotion statistics
 * @route   GET /api/admin/promotions/stats
 * @access  Private/Admin
 */
export const getPromotionStats = async (req, res) => {
  try {
    const { period = 'all' } = req.query; // all, today, week, month

    let dateFilter = {};
    const now = new Date();

    switch (period) {
      case 'today':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.setHours(0, 0, 0, 0)),
            $lte: new Date(now.setHours(23, 59, 59, 999))
          }
        };
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        dateFilter = { createdAt: { $gte: weekStart } };
        break;
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = { createdAt: { $gte: monthStart } };
        break;
    }

    const stats = await PromotionModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalPayout: { $sum: '$payoutAmount' }
        }
      }
    ]);

    const totalPromotions = await PromotionModel.countDocuments(dateFilter);
    const totalPayout = await PromotionModel.aggregate([
      { $match: { ...dateFilter, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$payoutAmount' } } }
    ]);

    const statsObject = {
      total: totalPromotions,
      pending: 0,
      submitted: 0,
      validated: 0,
      paid: 0,
      rejected: 0,
      totalPayout: totalPayout[0]?.total || 0
    };

    stats.forEach(stat => {
      statsObject[stat._id] = stat.count;
    });

    // Additional metrics
    const averageProcessingTime = await PromotionModel.aggregate([
      { $match: { status: 'paid', submittedAt: { $exists: true }, paidAt: { $exists: true } } },
      {
        $project: {
          processingTime: { $subtract: ['$paidAt', '$submittedAt'] }
        }
      },
      {
        $group: {
          _id: null,
          avgProcessingTime: { $avg: '$processingTime' }
        }
      }
    ]);

    statsObject.avgProcessingTimeHours = averageProcessingTime[0] 
      ? (averageProcessingTime[0].avgProcessingTime / (1000 * 60 * 60)).toFixed(2)
      : 0;

    res.status(200).json({
      success: true,
      data: statsObject,
      message: 'Promotion statistics retrieved successfully'
    });

  } catch (error) {
    console.error('Get promotion stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving promotion statistics',
      error: error.message
    });
  }
};