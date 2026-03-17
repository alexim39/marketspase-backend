import { StoreModel } from '../../models/store.model.js';
import { ProductModel, PromotionTrackingModel } from '../../models/product.model.js';
import { StoreAnalyticsModel } from '../../models/store-analytics.model.js';
import mongoose from 'mongoose';


/**
 * @desc    Get store products with filters
 * @route   GET /api/stores/:storeId/products
 * @access  Public
 */
export const getStorefrontProducts = async (req, res) => {
  try {
    const { storeId } = req.params;
    const {
      page = 1,
      limit = 12,
      category,
      sortBy = 'newest',
      minPrice,
      maxPrice,
      inStock,
      featured,
      search
    } = req.query;

    // Validate store
    const store = await StoreModel.findById(storeId);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Build query
    const query = {
      store: storeId,
      isActive: true,
      isDeleted: { $ne: true }
    };

    // Apply filters
    if (category) {
      query.category = category;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (inStock === 'true') {
      query.$or = [
        { manageStock: false },
        { manageStock: true, quantity: { $gt: 0 } }
      ];
    }

    if (featured === 'true') {
      query.isFeatured = true;
    }

    // Apply search
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
        { 'attributes.values': { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort options
    let sortOptions = {};
    switch (sortBy) {
      case 'price-low':
        sortOptions = { price: 1 };
        break;
      case 'price-high':
        sortOptions = { price: -1 };
        break;
      case 'popular':
        sortOptions = { purchaseCount: -1 };
        break;
      case 'rating':
        sortOptions = { averageRating: -1 };
        break;
      case 'featured':
        sortOptions = { isFeatured: -1, createdAt: -1 };
        break;
      default: // 'newest'
        sortOptions = { createdAt: -1 };
    }

    // Execute query with pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    const [products, total] = await Promise.all([
      ProductModel.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .select('name description price originalPrice images category tags quantity manageStock lowStockAlert averageRating ratingCount viewCount purchaseCount isActive isFeatured createdAt updatedAt'),
      ProductModel.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.status(200).json({
      success: true,
      data: products,
      total,
      page: Number(page),
      totalPages
    });
  } catch (error) {
    console.error('Get store products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};