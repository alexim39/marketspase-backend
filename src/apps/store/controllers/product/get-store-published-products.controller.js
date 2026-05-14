// controllers/product/get-published-store-products.controller.js
import { ProductModel } from '../../models/promotion/index.js';
import { PromotionTrackingModel } from '../../models/promotion/index.js';
import { StoreModel } from '../../models/store/index.js';
import mongoose from 'mongoose';
export const getPublishedStoreProducts = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { 
      page = 1, 
      limit = 12,
      search,
      category,
      minPrice,
      maxPrice,
      minCommission,
      maxCommission,
      sortBy = 'newest',
      sortDirection = 'desc',
      inStock
    } = req.query;

    // Validate store exists and is active
    const store = await StoreModel.findOne({
      _id: new mongoose.Types.ObjectId(storeId),
      isDeleted: false,
      isActive: true
    }).select('name logo storeLink description verificationTier isVerified category');

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or is inactive'
      });
    }

    // Base query - only published products for this store
    const baseQuery = {
      store: new mongoose.Types.ObjectId(storeId),
      isPublished: true,
      isActive: true,
      isDeleted: false
    };

    // Search filter
    if (search && search.trim()) {
      baseQuery.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
        { brand: { $regex: search.trim(), $options: 'i' } },
        { sku: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // Category filter
    if (category) {
      baseQuery.category = category;
    }

    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      baseQuery.price = {};
      if (minPrice !== undefined) baseQuery.price.$gte = parseFloat(minPrice);
      if (maxPrice !== undefined) baseQuery.price.$lte = parseFloat(maxPrice);
    }

    // Stock filter
    if (inStock === 'true') {
      baseQuery.quantity = { $gt: 0 };
    } else if (inStock === 'false') {
      baseQuery.quantity = { $lte: 0 };
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Sort mapping
    const sortMapping = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      price_low: { price: 1 },
      price_high: { price: -1 },
      name: { name: 1 },
      popularity: { viewCount: -1 },
      bestselling: { purchaseCount: -1 },
      discount: { originalPrice: -1 }
    };

    const sort = sortMapping[sortBy] || sortMapping.newest;

    // Get total count for pagination
    const totalCount = await ProductModel.countDocuments(baseQuery);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Fetch products
    const products = await ProductModel.find(baseQuery)
      .select('-__v -createdBy -updatedBy -deletedBy -digitalProduct.fileUrl -costPrice -meta')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get promotion data for each product
    const productIds = products.map(p => p._id);
    const promotions = await PromotionTrackingModel.find({
      product: { $in: productIds },
      isActive: true,
      isApproved: true
    })
    .select('product commissionRate commissionType fixedCommission uniqueCode uniqueId viewCount clickCount conversionCount')
    .lean();

    // Create a map of product ID to promotion data
    const promotionMap = {};
    promotions.forEach(promo => {
      promotionMap[promo.product.toString()] = promo;
    });

    // Format products with promotion data
    const formattedProducts = products.map(product => {
      const promo = promotionMap[product._id.toString()];
      return {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        originalPrice: product.originalPrice || 0,
        currency: product.currency || 'NGN',
        images: product.images || [],
        mainImage: product.images?.find(img => img.isMain)?.url || product.images?.[0]?.url || null,
        category: product.category,
        brand: product.brand,
        tags: product.tags || [],
        sku: product.sku,
        quantity: product.quantity || 0,
        isInStock: product.manageStock ? product.quantity > 0 : true,
        isLowStock: product.manageStock ? (product.quantity > 0 && product.quantity <= (product.lowStockAlert || 5)) : false,
        discountPercentage: product.originalPrice && product.originalPrice > product.price 
          ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) 
          : 0,
        viewCount: product.viewCount || 0,
        purchaseCount: product.purchaseCount || 0,
        averageRating: product.averageRating || 0,
        ratingCount: product.ratingCount || 0,
        isFeatured: product.isFeatured || false,
        requiresShipping: product.requiresShipping !== false,
        weight: product.weight,
        dimensions: product.dimensions,
        createdAt: product.createdAt,
        store: {
          _id: store._id,
          name: store.name,
          logo: store.logo,
          storeLink: store.storeLink,
          verificationTier: store.verificationTier,
          isVerified: store.isVerified
        },
        promotion: promo ? {
          commissionRate: promo.commissionRate,
          commissionType: promo.commissionType,
          fixedCommission: promo.fixedCommission || 0,
          uniqueCode: promo.uniqueCode,
          uniqueId: promo.uniqueId,
          viewCount: promo.viewCount || 0,
          clickCount: promo.clickCount || 0,
          conversions: promo.conversionCount || 0
        } : {
          commissionRate: 0,
          commissionType: 'percentage',
          fixedCommission: 0,
          uniqueCode: null,
          uniqueId: null,
          viewCount: 0,
          clickCount: 0,
          conversions: 0
        }
      };
    });

    // Get filter options (categories, price range)
    const filterAggregation = await ProductModel.aggregate([
      { $match: { store: new mongoose.Types.ObjectId(storeId), isPublished: true, isActive: true, isDeleted: false } },
      {
        $facet: {
          categories: [
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $project: { name: '$_id', count: 1, _id: 0 } }
          ],
          priceRange: [
            {
              $group: {
                _id: null,
                minPrice: { $min: '$price' },
                maxPrice: { $max: '$price' },
                avgPrice: { $avg: '$price' }
              }
            },
            { $project: { _id: 0 } }
          ]
        }
      }
    ]);

    const filterOptions = filterAggregation[0] || {};
    const priceRangeData = filterOptions.priceRange?.[0] || { minPrice: 0, maxPrice: 0, avgPrice: 0 };

    // Commission range from promotions
    const commissionRange = await PromotionTrackingModel.aggregate([
      { 
        $match: { 
          product: { $in: productIds },
          isActive: true,
          isApproved: true
        } 
      },
      {
        $group: {
          _id: null,
          minCommission: { $min: '$commissionRate' },
          maxCommission: { $max: '$commissionRate' },
          avgCommission: { $avg: '$commissionRate' }
        }
      }
    ]);

    const commissionRangeData = commissionRange[0] || { minCommission: 0, maxCommission: 0, avgCommission: 0 };

    return res.status(200).json({
      success: true,
      store: {
        _id: store._id,
        name: store.name,
        logo: store.logo,
        storeLink: store.storeLink,
        description: store.description,
        verificationTier: store.verificationTier,
        isVerified: store.isVerified,
        category: store.category
      },
      data: formattedProducts,
      total: totalCount,
      count: formattedProducts.length,
      totalPages,
      currentPage: pageNum,
      filters: {
        categories: filterOptions.categories || [],
        priceRange: priceRangeData,
        commissionRange: commissionRangeData
      }
    });

  } catch (error) {
    console.error('Error fetching published store products:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch store products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};