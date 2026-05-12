import mongoose from 'mongoose';
import { ProductModel, PromotionTrackingModel } from '../../models/promotion/index.js';
import {
  buildAffiliateUrl,
  calculateCommissionForAmount,
  getProductAffiliateSettings,
  roundMoney
} from '../../services/storefront-affiliate.service.js';

// Helper function to get product promotion stats
async function getProductPromotionStats(productId) {
  const stats = await PromotionTrackingModel.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(productId),
        isActive: true,
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
 * @desc    Get single product details for promotion
 * @route   GET /api/promoter/products/:id
 * @access  Private/Promoter
 */
export const getPromoterProductDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    //console.log('Fetching product details for ID:', id, 'by promoter:', userId);

    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    const product = await ProductModel.findOne({
      _id: id,
      isActive: true,
      isDeleted: false
    }).populate('store', 'name logo description isVerified verificationTier storeLink followers');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or not available for promotion'
      });
    }

    //.log('Product fetched from DB:', product);

    // Get product statistics
    const stats = await getProductPromotionStats(id);
    //console.log('Product stats:', stats);

    // If promoter is logged in, check if they have tracked this product
    let userPromotion = null;
    if (userId) {
      userPromotion = await PromotionTrackingModel.findOne({
        product: id,
        promoter: userId,
        isActive: true
      });
      //console.log('User promotion details:', userPromotion);
    }

    const affiliateSettings = getProductAffiliateSettings(product);
    const commissionPerSale = calculateCommissionForAmount(product.price, affiliateSettings);

    // Format response
    const response = {
      _id: product._id,
      name: product.name,
      description: product.description,
      price: product.price,
      originalPrice: product.originalPrice,
      images: product.images,
      category: product.category,
      tags: product.tags,
      sku: product.sku,
      averageRating: product.averageRating,
      ratingCount: product.ratingCount,
      purchaseCount: product.purchaseCount,
      viewCount: product.viewCount,
      affiliate: affiliateSettings,
      amountReceivable: roundMoney(product.price - commissionPerSale),
      commissionPerSale,
      createdAt: product.createdAt,
      store: {
        _id: product.store._id,
        name: product.store.name,
        logo: product.store.logo,
        description: product.store.description,
        isVerified: product.store.isVerified,
        verificationTier: product.store.verificationTier,
        storeLink: product.store.storeLink,
        followers: product.store.followers || [],
        followerCount: product.store.followers?.length || 0
      },
      promotion: {
        commissionRate: affiliateSettings.commissionRate,
        commissionType: affiliateSettings.commissionType,
        fixedCommission: affiliateSettings.fixedCommission,
        isActive: affiliateSettings.enabled,
        isApproved: userPromotion?.isApproved ?? affiliateSettings.autoApprovePromoters,
        trackingCode: userPromotion?.uniqueCode || '',
        uniqueId: userPromotion?.uniqueId || '',
        affiliateUrl: userPromotion?.uniqueCode ? buildAffiliateUrl(req, userPromotion.uniqueCode) : '',
        promotionUrl: userPromotion?.uniqueCode ? buildAffiliateUrl(req, userPromotion.uniqueCode) : '',
        commissionPerSale,
        amountReceivable: roundMoney(product.price - commissionPerSale),
        viewCount: userPromotion?.viewCount || stats.totalViews,
        views: userPromotion?.viewCount || stats.totalViews,
        clickCount: userPromotion?.clickCount || stats.totalClicks,
        conversionCount: userPromotion?.conversionCount || stats.totalConversions,
        conversions: userPromotion?.conversionCount || stats.totalConversions,
        earnings: userPromotion?.earnings || 0,
        clickThroughRate: stats.clickThroughRate,
        conversionRate: stats.conversionRate,
        averageOrderValue: stats.averageOrderValue
      },
      stats,
      userPromotion: userPromotion ? {
        trackingCode: userPromotion.uniqueCode,
        uniqueId: userPromotion.uniqueId,
        affiliateUrl: buildAffiliateUrl(req, userPromotion.uniqueCode),
        commissionRate: userPromotion.commissionRate,
        earnings: userPromotion.earnings,
        clicks: userPromotion.clickCount,
        conversions: userPromotion.conversionCount
      } : null
    };

    // Record view if promoter is logged in
    if (userId && userPromotion) {
      await PromotionTrackingModel.findByIdAndUpdate(
        userPromotion._id,
        { $inc: { viewCount: 1 } }
      );
    }

    res.status(200).json({
      success: true,
      data: response
    });

  } catch (error) {
    //console.error('Error fetching product details:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching product details',
      error: error.message
    });
  }
};
