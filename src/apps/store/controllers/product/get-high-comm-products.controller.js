import { PromotionTrackingModel } from '../../models/promotion/index.js';

/**
 * @desc    Get high commission products
 * @route   GET /api/promoter/products/high-commission
 * @access  Private/Promoter
 */
export const getHighCommissionProducts = async (req, res) => {
  try {
    const { minCommission = 20, limit = 20 } = req.query;
    const minCommissionNum = parseFloat(minCommission);
    const limitNum = parseInt(limit, 10);

    const highCommissionProducts = await PromotionTrackingModel.aggregate([
      {
        $match: {
          isActive: true,
          isApproved: true,
          commissionRate: { $gte: minCommissionNum }
        }
      },
      {
        $sort: { commissionRate: -1 }
      },
      {
        $limit: limitNum
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
          originalPrice: '$productDetails.originalPrice',
          images: '$productDetails.images',
          category: '$productDetails.category',
          store: {
            _id: '$storeDetails._id',
            name: '$storeDetails.name',
            logo: '$storeDetails.logo',
            isVerified: '$storeDetails.isVerified'
          },
          promotion: {
            commissionRate: '$commissionRate',
            commissionType: '$commissionType',
            fixedCommission: '$fixedCommission',
            trackingCode: '$uniqueCode',
            viewCount: '$viewCount',
            clickCount: '$clickCount',
            conversionCount: '$conversionCount',
            earnings: '$earnings'
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      count: highCommissionProducts.length,
      minCommission: minCommissionNum,
      data: highCommissionProducts
    });

  } catch (error) {
    console.error('Error fetching high commission products:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching high commission products',
      error: error.message
    });
  }
};