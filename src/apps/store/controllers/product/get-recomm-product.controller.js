import mongoose from 'mongoose';
import { ProductModel } from '../../models/product.model.js';
import { PromotionTrackingModel } from '../../models/product.model.js';
import { StoreModel } from '../../models/store.model.js';

/**
 * @desc    Get recommended products for a promoter
 * @route   GET /api/promoter/products/recommended
 * @access  Private/Promoter
 */
export const getRecommendedProducts = async (req, res) => {
  try {
    const promoterId = req.user?._id;
    const { limit = 10 } = req.query;
    const limitNum = parseInt(limit, 10);

    if (!promoterId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get promoter's previously promoted categories
    const promoterCategories = await PromotionTrackingModel.aggregate([
      {
        $match: {
          promoter: new mongoose.Types.ObjectId(promoterId),
          isActive: true
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      {
        $unwind: '$productDetails'
      },
      {
        $group: {
          _id: '$productDetails.category',
          count: { $sum: 1 },
          avgConversionRate: { $avg: '$conversionRate' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 5
      }
    ]);

    const preferredCategories = promoterCategories.map(pc => pc._id);

    // If no previous promotions, get popular categories
    let categoriesToUse = preferredCategories;
    if (categoriesToUse.length === 0) {
      const popularCategories = await ProductModel.aggregate([
        {
          $match: {
            isActive: true,
            isDeleted: false
          }
        },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 3
        }
      ]);
      categoriesToUse = popularCategories.map(pc => pc._id);
    }

    // Get recommended products
    const recommendedProducts = await ProductModel.aggregate([
      {
        $match: {
          isActive: true,
          isDeleted: false,
          category: { $in: categoriesToUse }
        }
      },
      {
        $lookup: {
          from: 'promotiontrackings',
          let: { productId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$product', '$$productId'] },
                    { $eq: ['$isActive', true] },
                    { $eq: ['$isApproved', true] }
                  ]
                }
              }
            },
            {
              $sort: { commissionRate: -1 }
            },
            {
              $limit: 1
            }
          ],
          as: 'promotion'
        }
      },
      {
        $unwind: {
          path: '$promotion',
          preserveNullAndEmptyArrays: false
        }
      },
      {
        $lookup: {
          from: 'stores',
          localField: 'store',
          foreignField: '_id',
          as: 'storeInfo'
        }
      },
      {
        $unwind: '$storeInfo'
      },
      {
        // Exclude products already promoted by this user
        $match: {
          'promotion.promoter': { $ne: new mongoose.Types.ObjectId(promoterId) }
        }
      },
      {
        $sort: {
          'promotion.commissionRate': -1,
          purchaseCount: -1
        }
      },
      {
        $limit: limitNum
      },
      {
        $project: {
          name: 1,
          description: 1,
          price: 1,
          images: 1,
          category: 1,
          purchaseCount: 1,
          averageRating: 1,
          store: {
            _id: '$storeInfo._id',
            name: '$storeInfo.name',
            logo: '$storeInfo.logo',
            isVerified: '$storeInfo.isVerified'
          },
          promotion: {
            commissionRate: '$promotion.commissionRate',
            trackingCode: '$promotion.uniqueCode',
            conversionRate: '$promotion.conversionRate'
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      count: recommendedProducts.length,
      basedOn: preferredCategories.length > 0 ? 'your_promotion_history' : 'popular_categories',
      data: recommendedProducts
    });

  } catch (error) {
    console.error('Error fetching recommended products:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching recommended products',
      error: error.message
    });
  }
};