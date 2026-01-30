// controllers/promoterProduct.controller.js - Updated version
import mongoose from 'mongoose';
import { ProductModel } from '../../models/product.model.js';
import { PromotionTrackingModel } from '../../models/product.model.js';
import { StoreModel } from '../../models/store.model.js';

export const getPromoterProducts = async (req, res) => {
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

    // Parse pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build base filter query
    let filterQuery = {
      isActive: true,
      isDeleted: false
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
        // For commission, we need to handle differently
        // For now, sort by createdAt
        productsQuery = productsQuery.sort({ createdAt: sortDirection === 'asc' ? 1 : -1 });
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

    // Transform products to match UI expectations
    const transformedProducts = await Promise.all(products.map(async (product) => {
      // Get store details
      const store = product.store || {};
      
      // For now, use default promotion data since we don't have real promotion tracking
      // In production, you would fetch actual promotion data
      const defaultPromotion = {
        commissionRate: 15, // Default commission rate
        commissionType: 'percentage',
        fixedCommission: 0,
        isActive: true,
        isApproved: true,
        trackingCode: `PROMO-${product._id.toString().substring(0, 8).toUpperCase()}`,
        viewCount: product.viewCount || 0,
        clickCount: Math.floor((product.viewCount || 0) * 0.3), // Simulated clicks (30% of views)
        conversionCount: Math.floor((product.viewCount || 0) * 0.05), // Simulated conversions (5% of views)
        earnings: (product.price || 0) * 0.15 * Math.floor((product.viewCount || 0) * 0.05) // Simulated earnings
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
          isDeleted: false
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

    // For commission stats, use default values for now
    const commissionStats = {
      minCommission: 10,
      maxCommission: 30,
      avgCommission: 15,
      highCommissionCount: transformedProducts.filter(p => p.promotion.commissionRate >= 20).length
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

// Simple version without complex aggregations
export const getPromoterProductsSimple = async (req, res) => {
  try {
    const products = await ProductModel.find({
      isActive: true,
      isDeleted: false
    })
    .populate('store', 'name logo description isVerified verificationTier storeLink')
    .limit(50); // Limit for testing

    // Transform to match UI
    const transformedProducts = products.map(product => ({
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
        _id: product.store?._id?.toString() || product.store?.toString(),
        name: product.store?.name || 'Unknown Store',
        logo: product.store?.logo || '',
        description: product.store?.description || '',
        isVerified: product.store?.isVerified || false,
        verificationTier: product.store?.verificationTier || 'basic',
        storeLink: product.store?.storeLink || ''
      },
      promotion: {
        commissionRate: 15 + Math.floor(Math.random() * 15), // Random between 15-30%
        commissionType: 'percentage',
        isActive: true,
        isApproved: true,
        trackingCode: `PROMO-${product._id.toString().substring(0, 8).toUpperCase()}`,
        viewCount: product.viewCount || Math.floor(Math.random() * 1000),
        clickCount: Math.floor((product.viewCount || 100) * 0.3),
        conversionCount: Math.floor((product.viewCount || 100) * 0.05),
        earnings: (product.price || 0) * 0.15 * Math.floor((product.viewCount || 100) * 0.05)
      }
    }));

    // Get categories
    const categories = await ProductModel.aggregate([
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
        $project: {
          name: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    res.status(200).json({
      success: true,
      count: transformedProducts.length,
      total: transformedProducts.length,
      totalPages: 1,
      currentPage: 1,
      data: transformedProducts,
      filters: {
        categories: categories,
        priceRange: {
          minPrice: Math.min(...transformedProducts.map(p => p.price)),
          maxPrice: Math.max(...transformedProducts.map(p => p.price)),
          avgPrice: transformedProducts.reduce((sum, p) => sum + p.price, 0) / transformedProducts.length
        },
        commissionRange: {
          minCommission: Math.min(...transformedProducts.map(p => p.promotion.commissionRate)),
          maxCommission: Math.max(...transformedProducts.map(p => p.promotion.commissionRate)),
          avgCommission: transformedProducts.reduce((sum, p) => sum + p.promotion.commissionRate, 0) / transformedProducts.length,
          highCommissionCount: transformedProducts.filter(p => p.promotion.commissionRate >= 20).length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};