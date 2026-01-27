import mongoose from 'mongoose';
import { ProductModel } from '../../models/product.model.js';
import { PromotionTrackingModel } from '../../models/product.model.js';
import { StoreModel } from '../../models/store.model.js';


// Helper function to get product promotion stats
async function getProductPromotionStats(productId) {
  const stats = await PromotionTrackingModel.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(productId),
        isActive: true,
        isApproved: true
      }
    },
    {
      $group: {
        _id: null,
        totalViews: { $sum: '$viewCount' },
        totalClicks: { $sum: '$clickCount' },
        totalConversions: { $sum: '$conversionCount' },
        totalEarnings: { $sum: '$earnings' },
        avgCommission: { $avg: '$commissionRate' },
        promoterCount: { $sum: 1 },
        avgConversionRate: {
          $avg: {
            $cond: {
              if: { $eq: ['$clickCount', 0] },
              then: 0,
              else: {
                $multiply: [
                  { $divide: ['$conversionCount', '$clickCount'] },
                  100
                ]
              }
            }
          }
        }
      }
    }
  ]);

  return stats[0] || {
    totalViews: 0,
    totalClicks: 0,
    totalConversions: 0,
    totalEarnings: 0,
    avgCommission: 0,
    promoterCount: 0,
    avgConversionRate: 0
  };
}

/**
 * @desc    Get product promotion statistics
 * @route   GET /api/promoter/products/:id/stats
 * @access  Private/Promoter
 */
export const getProductPromotionStatsController = async (req, res) => {
  try {
    const { id } = req.params;

    const stats = await getProductPromotionStats(id);

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching product stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching product statistics',
      error: error.message
    });
  }
};