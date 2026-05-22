// controllers/product/delete-product.controller.js
import { ProductModel, PromotionTrackingModel, InventoryHistoryModel } from '../../models/promotion/index.js';
import { StoreModel } from '../../models/store/index.js';
import { deleteFromCloudinary } from '../../utils/cloudinary.js';
import mongoose from 'mongoose';
import { ensureStoreWriteAccess } from '../../services/store-authorization.service.js';

export const deleteProduct = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log('Delete product request received');
    
    const userId = req.userId;
    const storeId = req.params.storeId;
    const productId = req.params.productId;

    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!storeId || !productId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Store ID and Product ID are required'
      });
    }

    // Verify store ownership (supports legacy ownership formats)
    try {
      await ensureStoreWriteAccess({ storeId, req, session });
    } catch (authError) {
      await session.abortTransaction();
      session.endSession();
      const status = authError.status || 403;
      return res.status(status).json({
        success: false,
        message: status === 404 ? 'Store not found' : 'You do not have permission to delete products in this store',
      });
    }

    // Find existing product
    const existingProduct = await ProductModel.findOne({
      _id: productId,
      store: storeId,
      isDeleted: false
    }).session(session);

    if (!existingProduct) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // 1. Delete all product images from Cloudinary
    if (existingProduct.images && existingProduct.images.length > 0) {
      for (const image of existingProduct.images) {
        try {
          await deleteFromCloudinary(image.url);
          console.log(`Deleted image: ${image.url}`);
        } catch (deleteError) {
          console.error('Failed to delete image from Cloudinary:', deleteError);
          // Continue with deletion even if image removal fails
        }
      }
    }

    // 2. Delete digital product file if exists
    if (existingProduct.isDigital && existingProduct.digitalProduct?.fileUrl) {
      try {
        await deleteFromCloudinary(existingProduct.digitalProduct.fileUrl);
        console.log(`Deleted digital file: ${existingProduct.digitalProduct.fileUrl}`);
      } catch (deleteError) {
        console.error('Failed to delete digital file from Cloudinary:', deleteError);
      }
    }

    // 3. Soft delete the product (or hard delete - choose based on your requirements)
    // Option A: Soft Delete (recommended - preserves data for analytics)
    existingProduct.isDeleted = true;
    existingProduct.deletedAt = new Date();
    existingProduct.isActive = false;
    existingProduct.deletedBy = userId;
    await existingProduct.save({ session });

    // Option B: Hard Delete (permanent removal)
    // await ProductModel.findByIdAndDelete(productId).session(session);

    // 4. Remove product reference from store
    await StoreModel.findByIdAndUpdate(
      storeId,
      { $pull: { storeProducts: productId } },
      { session }
    );

    // 5. Deactivate all promotion tracking for this product
    await PromotionTrackingModel.updateMany(
      { product: productId },
      { 
        $set: { 
          isActive: false,
          isApproved: false,
          deactivatedAt: new Date(),
          deactivatedBy: userId,
          deactivationReason: 'Product deleted'
        } 
      }
    ).session(session);

    // 6. Add deletion record to inventory history
    const inventoryHistory = new InventoryHistoryModel({
      product: productId,
      store: storeId,
      previousQuantity: existingProduct.quantity,
      newQuantity: 0,
      changeAmount: -existingProduct.quantity,
      changeType: 'deletion',
      user: userId,
      reason: 'Product deleted',
      notes: `Product "${existingProduct.name}" was deleted`
    });
    await inventoryHistory.save({ session });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: {
        _id: existingProduct._id,
        name: existingProduct.name,
        deletedAt: existingProduct.deletedAt
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Product deletion error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Permanent delete controller (if you need hard delete option)
 */
export const permanentDeleteProduct = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.userId;
    const storeId = req.params.storeId;
    const productId = req.params.productId;

    //console.log('userId', userId, 'storeId', storeId, ' productId', productId);

    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!storeId || !productId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Store ID and Product ID are required',
      });
    }

    // Verify store ownership (supports legacy ownership formats)
    try {
      await ensureStoreWriteAccess({ storeId, req, session });
    } catch (authError) {
      await session.abortTransaction();
      session.endSession();
      const status = authError.status || 403;
      return res.status(status).json({
        success: false,
        message: status === 404 ? 'Store not found' : 'You do not have permission to delete products in this store',
      });
    }

    const existingProduct = await ProductModel.findOne({
      _id: productId,
      store: storeId
    }).session(session);

    if (!existingProduct) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Delete all associated data
    // 1. Delete images from Cloudinary
    if (existingProduct.images) {
      for (const image of existingProduct.images) {
        await deleteFromCloudinary(image.url).catch(e => console.error(e));
      }
    }

    // 2. Delete digital file
    if (existingProduct.digitalProduct?.fileUrl) {
      await deleteFromCloudinary(existingProduct.digitalProduct.fileUrl).catch(e => console.error(e));
    }

    // 3. Delete product from database
    await ProductModel.findByIdAndDelete(productId).session(session);

    // 4. Remove from store
    await StoreModel.findByIdAndUpdate(
      storeId,
      { $pull: { storeProducts: productId } },
      { session }
    );

    // 5. Delete promotion tracking records
    await PromotionTrackingModel.deleteMany({ product: productId }).session(session);

    // 6. Delete inventory history
    await InventoryHistoryModel.deleteMany({ product: productId }).session(session);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: 'Product permanently deleted'
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Permanent deletion error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete product' });
  }
};
