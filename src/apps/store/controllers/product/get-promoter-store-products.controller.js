// controllers/promoterProduct.controller.js - Updated version
import mongoose from 'mongoose';
import { ProductModel, PromotionTrackingModel } from '../../models/promotion/index.js';
import {
  buildAffiliateUrl,
  buildStorePublicUrl,
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
      sortBy = 'commission',
      sortDirection = 'desc'
    } = req.query;
    const activePromoterId = req.userId;

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

    // Backfill: generate UPI for existing promotions that don't have one
    for (const [productId, promo] of promotionByProduct) {
      if (!promo.upi) {
        promo.upi = generatePromotionUpi();
        promo.publicUrl = buildStorePublicUrl(req, promo.upi);
        PromotionTrackingModel.updateOne(
          { _id: promo._id },
          { $set: { upi: promo.upi, publicUrl: promo.publicUrl } }
        ).catch(() => {});
      } else if (!promo.publicUrl) {
        promo.publicUrl = buildStorePublicUrl(req, promo.upi);
        PromotionTrackingModel.updateOne(
          { _id: promo._id },
          { $set: { publicUrl: promo.publicUrl } }
        ).catch(() => {});
      }
    }

    function generatePromotionUpi() {
      const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let result = '';
      for (let i = 0; i < 10; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
      return result;
    }

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
        publicUrl: userPromotion?.upi ? buildStorePublicUrl(req, userPromotion.upi) : (userPromotion?.uniqueCode ? buildAffiliateUrl(req, userPromotion.uniqueCode) : ''),
        commissionPerSale,
        amountReceivable: roundMoney((product.price || 0) - commissionPerSale),
        viewCount: stats.viewCount || 0,
        views: stats.viewCount || 0,
        clickCount: stats.clickCount || 0,
        conversionCount: stats.conversionCount || 0,
        conversions: stats.conversionCount || 0,
        earnings: stats.earnings || 0,
        averageConversionRate: stats.clickCount > 0 ? Math.round((stats.conversionCount / stats.clickCount) * 100 * 10) / 10 : 0,
        estimatedEarningsPerPromo: stats.clickCount > 0 ? Math.round(stats.earnings / stats.clickCount) : 0,
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
        promotion: defaultPromotion,
        averageConversionRate: defaultPromotion.averageConversionRate,
        estimatedEarningsPerPromo: defaultPromotion.estimatedEarningsPerPromo,
      };
    }));

    // Also fetch services for a unified offerings page
    let servicesTotal = 0;
    try {
      const ServiceModel = (await import('../../models/service/service.model.js')).ServiceModel;
      const serviceFilter = {
        isActive: true, isDeleted: false, isPublished: true,
        'affiliate.enabled': { $ne: false },
      };
      if (categories) serviceFilter.category = { $in: categories.split(',').map(c => c.trim()) };
      if (search) {
        const sRegex = new RegExp(search, 'i');
        serviceFilter.$or = [{ name: sRegex }, { description: sRegex }, { category: sRegex }];
      }
      if (minPrice || maxPrice) { serviceFilter.price = {}; if (minPrice) serviceFilter.price.$gte = parseFloat(minPrice); if (maxPrice) serviceFilter.price.$lte = parseFloat(maxPrice); }

      const serviceSortMap = {
        commission: { 'affiliate.leadCommission': sortDirection === 'desc' ? -1 : 1 },
        popularity: { inquiryCount: -1 },
        price: { price: sortDirection === 'desc' ? -1 : 1 },
        newest: { createdAt: -1 },
      };
      const svcSort = serviceSortMap[sortBy] || { createdAt: -1 };

      servicesTotal = await ServiceModel.countDocuments(serviceFilter);
      const serviceDocs = await ServiceModel.find(serviceFilter)
        .populate('store', 'name logo description isVerified verificationTier')
        .sort(svcSort)
        .skip(skip)
        .limit(limitNum)
        .lean();

      // Backfill UPI for existing services that don't have one
      for (const svc of serviceDocs) {
        if (!svc.upi) {
          svc.upi = generatePromotionUpi();
          ServiceModel.updateOne({ _id: svc._id }, { $set: { upi: svc.upi } }).catch(() => {});
        }
      }

      const normalizedServices = serviceDocs.map(service => {
        const svcPublicUrl = service.upi ? buildStorePublicUrl(req, service.upi) : '';
        return ({
        _id: service._id.toString(),
        type: 'service',
        name: service.name,
        description: service.description?.substring(0, 200) || '',
        price: service.price || 0,
        originalPrice: null,
        images: (service.media?.length ? service.media : service.portfolio || []).slice(0, 1),
        category: service.category,
        tags: [],
        sku: '',
        averageRating: service.averageRating || 0,
        ratingCount: service.ratingCount || 0,
        purchaseCount: service.inquiryCount || 0,
        viewCount: service.viewCount || 0,
        createdAt: service.createdAt,
        store: {
          _id: service.store?._id?.toString() || '',
          name: service.store?.name || 'Unknown Store',
          logo: service.store?.logo || '',
          description: service.store?.description || '',
          isVerified: service.store?.isVerified || false,
          verificationTier: service.store?.verificationTier || 'basic',
          storeLink: '',
        },
        service: {
          pricingType: service.pricingType,
          packages: service.packages?.map(p => ({ name: p.name, price: p.price })),
          hourlyRate: service.hourlyRate,
          deliveryTime: service.deliveryTime,
          availability: service.availability,
          commissionType: service.affiliate?.commissionType || 'per_lead',
          leadCommission: service.affiliate?.leadCommission || 200,
          bookingCommission: service.affiliate?.bookingCommissionRate || 200,
          inquiries: service.inquiryCount || 0,
          bookings: service.bookingCount || 0,
        },
        promotion: {
          commissionRate: service.affiliate?.commissionType === 'per_lead'
            ? Math.round((service.affiliate?.leadCommission || 200) / Math.max(service.price || 1, 1) * 100)
            : Math.round((service.affiliate?.bookingCommissionRate || 200) / Math.max(service.price || 1, 1) * 100),
          commissionType: 'percentage',
          fixedCommission: 0,
          isActive: true,
          isApproved: true,
          trackingCode: '',
          uniqueId: '',
          affiliateUrl: svcPublicUrl,
          promotionUrl: svcPublicUrl,
          publicUrl: svcPublicUrl,
          commissionPerSale: service.affiliate?.commissionType === 'per_lead'
            ? (service.affiliate?.leadCommission || 200)
            : (service.affiliate?.bookingCommissionRate || 200),
          amountReceivable: 0,
          viewCount: service.viewCount || 0,
          views: service.viewCount || 0,
          clickCount: service.inquiryCount || 0,
          conversionCount: service.bookingCount || 0,
          conversions: service.bookingCount || 0,
          earnings: 0,
          averageConversionRate: 0,
          estimatedEarningsPerPromo: service.affiliate?.commissionType === 'per_lead'
            ? (service.affiliate?.leadCommission || 200)
            : (service.affiliate?.bookingCommissionRate || 200),
        },
        averageConversionRate: 0,
        estimatedEarningsPerPromo: service.affiliate?.commissionType === 'per_lead'
          ? (service.affiliate?.leadCommission || 200)
          : (service.affiliate?.bookingCommissionRate || 200),
      });
    });

    transformedProducts.push(...normalizedServices);
    } catch (svcErr) {
      console.error('Error fetching services for unified listing:', svcErr.message);
    }

    const totalAll = total + servicesTotal;

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
      total: totalAll,
      totalPages: Math.ceil(totalAll / limitNum),
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
