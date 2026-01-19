import { ProductModel } from '../../models/product.model.js';
import mongoose from "mongoose";

export const getProductById = async (req, res) => {
  try {
    const { storeId, productId } = req.params;
    
    if (!storeId || !mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid store ID'
      });
    }
    
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    const product = await ProductModel.findOne({
      _id: productId,
      store: storeId,
      isDeleted: false
    }).populate('createdBy', 'name email').lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error('Error fetching product:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};