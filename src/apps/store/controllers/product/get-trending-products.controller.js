import mongoose from 'mongoose';
import { ProductModel } from '../../models/product.model.js';
import { PromotionTrackingModel } from '../../models/product.model.js';
import { StoreModel } from '../../models/store.model.js';


/**
 * @desc    Get trending products for promoters
 * @route   GET /api/promoter/products/trending
 * @access  Private/Promoter
 */
export const getTrendingProducts = async (req, res) => {
  try {
    const { limit = 10, timeframe = 'week' } = req.query;
    const limitNum = parseInt(limit, 10);

    // Calculate date range based on timeframe
    let startDate = new Date();
    switch (timeframe) {
      case 'day':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    const trendingProducts = await PromotionTrackingModel.aggregate([
      {
        $match: {
          isActive: true,
          isApproved: true,
          lastActivityAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$product',
          totalViews: { $sum: '$viewCount' },
          totalClicks: { $sum: '$clickCount' },
          totalConversions: { $sum: '$conversionCount' },
          totalEarnings: { $sum: '$earnings' },
          avgCommission: { $avg: '$commissionRate' },
          promotionCount: { $sum: 1 }
        }
      },
      {
        $sort: {
          totalConversions: -1,
          totalClicks: -1
        }
      },
      {
        $limit: limitNum
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      {
        $unwind: '$productDetails'
      },
      {
        $match: {
          'productDetails.isActive': true,
          'productDetails.isDeleted': false
        }
      },
      {
        $lookup: {
          from: 'stores',
          localField: 'productDetails.store',
          foreignField: '_id',
          as: 'storeDetails'
        }
      },
      {
        $unwind: '$storeDetails'
      },
      {
        $project: {
          _id: '$productDetails._id',
          name: '$productDetails.name',
          description: '$productDetails.description',
          price: '$productDetails.price',
          images: '$productDetails.images',
          category: '$productDetails.category',
          store: {
            _id: '$storeDetails._id',
            name: '$storeDetails.name',
            logo: '$storeDetails.logo',
            isVerified: '$storeDetails.isVerified'
          },
          stats: {
            totalViews: '$totalViews',
            totalClicks: '$totalClicks',
            totalConversions: '$totalConversions',
            totalEarnings: '$totalEarnings',
            avgCommission: '$avgCommission',
            promotionCount: '$promotionCount'
          },
          conversionRate: {
            $cond: {
              if: { $eq: ['$totalClicks', 0] },
              then: 0,
              else: {
                $multiply: [
                  { $divide: ['$totalConversions', '$totalClicks'] },
                  100
                ]
              }
            }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      count: trendingProducts.length,
      timeframe,
      data: trendingProducts
    });

  } catch (error) {
    console.error('Error fetching trending products:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching trending products',
      error: error.message
    });
  }
};