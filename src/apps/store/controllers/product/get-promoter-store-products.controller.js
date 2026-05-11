// controllers/promoterProduct.controller.js - Updated version
import mongoose from 'mongoose';
import { ProductModel, PromotionTrackingModel } from '../../models/promotion/index.js';
import {
  buildAffiliateUrl,
  calculateCommissionForAmount,
  getProductAffiliateSettings,
  roundMoney
} from '../../services/storefront-affiliate.service.js';


export const getPromoterStoreProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      categories,
      minPrice,
      maxPrice,
      minCommission,
      maxCommission,
      search,
      promoterId,
      userId,
      sortBy = 'commission',
      sortDirection = 'desc'
    } = req.query;
    const activePromoterId = promoterId || userId;

    // Parse pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build base filter query
    let filterQuery = {
      isActive: true,
      isDeleted: false,
      isPublished: true,
      'affiliate.enabled': { $ne: false }
    };

    // Category filter
    if (categories) {
      const categoryArray = categories.split(',');
      filterQuery.category = { $in: categoryArray };
    }

    // Price range filter
    if (minPrice || maxPrice) {
      filterQuery.price = {};
      if (minPrice) filterQuery.price.$gte = parseFloat(minPrice);
      if (maxPrice) filterQuery.price.$lte = parseFloat(maxPrice);
    }

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filterQuery.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { tags: searchRegex },
        { category: searchRegex },
        { sku: searchRegex }
      ];
    }

    // Commission filter
    if (minCommission || maxCommission) {
      filterQuery['affiliate.commissionRate'] = {};
      if (minCommission) filterQuery['affiliate.commissionRate'].$gte = parseFloat(minCommission);
      if (maxCommission) filterQuery['affiliate.commissionRate'].$lte = parseFloat(maxCommission);
    }

    // Get total count
    const total = await ProductModel.countDocuments(filterQuery);

    // Get products with populated store info
    let productsQuery = ProductModel.find(filterQuery)
      .populate('store', 'name logo description isVerified verificationTier')
      .skip(skip)
      .limit(limitNum);

    // Apply sorting
    switch (sortBy) {
      case 'commission':
        productsQuery = productsQuery.sort({ 
          'affiliate.commissionRate': sortDirection === 'asc' ? 1 : -1,
          createdAt: -1
        });
        break;
      case 'popularity':
        productsQuery = productsQuery.sort({ 
          purchaseCount: sortDirection === 'asc' ? 1 : -1 
        });
        break;
      case 'price':
        productsQuery = productsQuery.sort({ 
          price: sortDirection === 'asc' ? 1 : -1 
        });
        break;
      case 'newest':
        productsQuery = productsQuery.sort({ 
          createdAt: sortDirection === 'asc' ? 1 : -1 
        });
        break;
      case 'name':
        productsQuery = productsQuery.sort({ 
          name: sortDirection === 'asc' ? 1 : -1 
        });
        break;
      default:
        productsQuery = productsQuery.sort({ createdAt: -1 });
    }

    const products = await productsQuery;
    const productIds = products.map(product => product._id);

    const [promotionStats, userPromotions] = await Promise.all([
      PromotionTrackingModel.aggregate([
        {
          $match: {
            product: { $in: productIds },
            isActive: true,
          }
        },
        {
          $group: {
            _id: '$product',
            viewCount: { $sum: '$viewCount' },
            clickCount: { $sum: '$clickCount' },
            conversionCount: { $sum: '$conversionCount' },
            earnings: { $sum: '$earnings' }
          }
        }
      ]),
      activePromoterId && mongoose.Types.ObjectId.isValid(activePromoterId)
        ? PromotionTrackingModel.find({
            product: { $in: productIds },
            promoter: activePromoterId,
            isActive: true,
          }).lean()
        : []
    ]);

    const statsByProduct = new Map(promotionStats.map(stat => [stat._id.toString(), stat]));
    const promotionByProduct = new Map(userPromotions.map(promotion => [promotion.product.toString(), promotion]));

    // Transform products to match UI expectations
    const transformedProducts = await Promise.all(products.map(async (product) => {
      // Get store details
      const store = product.store || {};
      
      const affiliateSettings = getProductAffiliateSettings(product);
      const stats = statsByProduct.get(product._id.toString()) || {};
      const userPromotion = promotionByProduct.get(product._id.toString());
      const commissionPerSale = calculateCommissionForAmount(product.price, affiliateSettings);
      const defaultPromotion = {
        commissionRate: affiliateSettings.commissionRate,
        commissionType: affiliateSettings.commissionType,
        fixedCommission: affiliateSettings.fixedCommission,
        isActive: true,
        isApproved: userPromotion?.isApproved ?? affiliateSettings.autoApprovePromoters,
        trackingCode: userPromotion?.uniqueCode || '',
        uniqueId: userPromotion?.uniqueId || '',
        affiliateUrl: userPromotion?.uniqueCode ? buildAffiliateUrl(req, userPromotion.uniqueCode) : '',
        promotionUrl: userPromotion?.uniqueCode ? buildAffiliateUrl(req, userPromotion.uniqueCode) : '',
        commissionPerSale,
        amountReceivable: roundMoney((product.price || 0) - commissionPerSale),
        viewCount: stats.viewCount || 0,
        views: stats.viewCount || 0,
        clickCount: stats.clickCount || 0,
        conversionCount: stats.conversionCount || 0,
        conversions: stats.conversionCount || 0,
        earnings: stats.earnings || 0
      };

      return {
        _id: product._id.toString(),
        name: product.name,
        description: product.description,
        price: product.price,
        originalPrice: product.originalPrice,
        images: product.images || [],
        category: product.category,
        tags: product.tags || [],
        sku: product.sku,
        averageRating: product.averageRating || 0,
        ratingCount: product.ratingCount || 0,
        purchaseCount: product.purchaseCount || 0,
        viewCount: product.viewCount || 0,
        createdAt: product.createdAt,
        store: {
          _id: store._id?.toString() || product.store?.toString(),
          name: store.name || 'Unknown Store',
          logo: store.logo || '',
          description: store.description || '',
          isVerified: store.isVerified || false,
          verificationTier: store.verificationTier || 'basic',
          storeLink: store.storeLink || ''
        },
        promotion: defaultPromotion
      };
    }));

    // Get categories for filters
    const categoriesAgg = await ProductModel.aggregate([
      {
        $match: {
          isActive: true,
          isDeleted: false,
          isPublished: true
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          name: '$_id',
          count: 1,
          _id: 0
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get price stats
    const priceStats = await ProductModel.aggregate([
      {
        $match: {
          isActive: true,
          isDeleted: false,
          isPublished: true
        }
      },
      {
        $group: {
          _id: null,
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          avgPrice: { $avg: '$price' }
        }
      }
    ]);

    const commissionAgg = await ProductModel.aggregate([
      {
        $match: {
          isActive: true,
          isDeleted: false,
          isPublished: true,
          'affiliate.enabled': { $ne: false }
        }
      },
      {
        $group: {
          _id: null,
          minCommission: { $min: '$affiliate.commissionRate' },
          maxCommission: { $max: '$affiliate.commissionRate' },
          avgCommission: { $avg: '$affiliate.commissionRate' },
          highCommissionCount: {
            $sum: { $cond: [{ $gte: ['$affiliate.commissionRate', 20] }, 1, 0] }
          }
        }
      }
    ]);
    const commissionStats = commissionAgg[0] || {
      minCommission: 0,
      maxCommission: 0,
      avgCommission: 0,
      highCommissionCount: 0
    };

    res.status(200).json({
      success: true,
      count: transformedProducts.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: transformedProducts,
      filters: {
        categories: categoriesAgg,
        priceRange: priceStats[0] || { minPrice: 0, maxPrice: 0, avgPrice: 0 },
        commissionRange: commissionStats
      }
    });

  } catch (error) {
    console.error('Error fetching promoter products:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
