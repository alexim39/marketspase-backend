import { ProductModel } from '../models/product.model.js';
import mongoose from "mongoose";
import { StoreModel } from '../models/store.model.js';

export const searchStoreProducts = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { q: searchQuery, category, page = 1, limit = 20 } = req.query;

    if (!storeId || !mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid store ID'
      });
    }

    // Check if store exists
    const storeExists = await StoreModel.findById(storeId);
    if (!storeExists) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const filter = { 
      store: storeId,
      isDeleted: false,
      isActive: true,
      $or: [
        { name: { $regex: new RegExp(searchQuery, 'i') } },
        { description: { $regex: new RegExp(searchQuery, 'i') } },
        { sku: { $regex: new RegExp(searchQuery, 'i') } },
        { tags: { $regex: new RegExp(searchQuery, 'i') } },
        { 'seo.keywords': { $regex: new RegExp(searchQuery, 'i') } }
      ]
    };

    if (category) {
      filter.category = { $regex: new RegExp(category, 'i') };
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      ProductModel.find(filter)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ProductModel.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      success: true,
      data: {
        products: products.map(product => ({
          _id: product._id,
          name: product.name,
          price: product.price,
          originalPrice: product.originalPrice,
          description: product.description,
          images: product.images,
          category: product.category,
          sku: product.sku,
          quantity: product.quantity,
          isInStock: product.quantity > 0
        })),
        total,
        page: pageNum,
        limit: limitNum,
        totalPages
      }
    });

  } catch (error) {
    console.error('Error searching products:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while searching products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};