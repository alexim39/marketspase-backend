import { ProductModel } from '../../models/promotion/index.js';
import mongoose from "mongoose";

/**
 * @desc    Get related products based on category, tags, and brand
 * @route   GET /api/storefront/products/:productId/related
 * @access  Public
 */
export const getRelatedProducts = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 8 } = req.query;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    // Get the current product
    const currentProduct = await ProductModel.findById(productId);
    
    if (!currentProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Build query for related products
    const query = {
      _id: { $ne: productId }, // Exclude current product
      store: currentProduct.store,
      isActive: true,
      isDeleted: { $ne: true },
      $or: [
        { category: currentProduct.category },
        { tags: { $in: currentProduct.tags || [] } },
        { brand: currentProduct.brand }
      ]
    };

    // If product has variants, include those in related logic
    if (currentProduct.hasVariants) {
      // Still include, but don't double count
    }

    // Find related products with scoring for relevance
    const relatedProducts = await ProductModel.aggregate([
      { $match: query },
      { $addFields: {
        relevanceScore: {
          $add: [
            { $cond: [{ $eq: ['$category', currentProduct.category] }, 10, 0] },
            { $cond: [{ $eq: ['$brand', currentProduct.brand] }, 5, 0] },
            { $multiply: [
              { $size: { $setIntersection: ['$tags', currentProduct.tags || []] } },
              2
            ]}
          ]
        }
      }},
      { $sort: { relevanceScore: -1, purchaseCount: -1, averageRating: -1 } },
      { $limit: parseInt(limit) },
      { $project: {
        _id: 1,
        name: 1,
        price: 1,
        originalPrice: 1,
        images: 1,
        category: 1,
        brand: 1,
        averageRating: 1,
        ratingCount: 1,
        purchaseCount: 1,
        isFeatured: 1,
        relevanceScore: 1
      }}
    ]);

    // If not enough related products, get popular products from same store
    if (relatedProducts.length < parseInt(limit)) {
      const remainingCount = parseInt(limit) - relatedProducts.length;
      const existingIds = relatedProducts.map(p => p._id);
      
      const popularProducts = await ProductModel.find({
        _id: { $ne: productId, $nin: existingIds },
        store: currentProduct.store,
        isActive: true,
        isDeleted: { $ne: true }
      })
      .sort({ purchaseCount: -1, averageRating: -1 })
      .limit(remainingCount)
      .select('_id name price originalPrice images category brand averageRating ratingCount purchaseCount isFeatured');

      relatedProducts.push(...popularProducts);
    }

    // If still not enough, get products from similar stores or general popular
    if (relatedProducts.length < parseInt(limit)) {
      // This would require additional logic based on your business rules
      // For now, we'll just return what we have
    }

    // Format response
    const formattedProducts = relatedProducts.map(product => ({
      ...product,
      discountPercentage: product.originalPrice && product.originalPrice > product.price
        ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
        : 0
    }));

    res.status(200).json({
      success: true,
      data: formattedProducts,
      count: formattedProducts.length
    });
  } catch (error) {
    console.error('Get related products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};