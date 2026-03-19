// controllers/store/delete-store.controller.js
import { StoreModel } from '../../models/store.model.js';
import { StoreAnalyticsModel } from '../../models/store-analytics.model.js';
import { WhatsAppIntegrationModel } from '../../models/whatsapp-integration.model.js';
import { ProductModel, PromotionTrackingModel, InventoryHistoryModel } from '../../models/promotion/index.js';
import { deleteMultipleFromCloudinary } from '../../utils/cloudinary.js';
import mongoose from 'mongoose';


/**
 * Permanently delete store (hard delete) - use with extreme caution
 * This completely removes all data and cannot be undone
 */
export const permanentDeleteStore = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.params?.userId || req.body.userId;
    const storeId = req.params.storeId;

    if (!userId || !storeId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'User ID and Store ID are required'
      });
    }

    // Verify store ownership
    const store = await StoreModel.findOne({
      _id: storeId,
      owner: userId
    }).session(session);

    if (!store) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Store not found or you do not have permission'
      });
    }

    // Get all products for Cloudinary cleanup
    const products = await ProductModel.find({ store: storeId }).session(session);
    
    // Collect all media URLs
    const allMediaUrls = [];
    
    // Add store logo
    if (store.logo) allMediaUrls.push(store.logo);
    
    // Add product images and digital files
    products.forEach(product => {
      if (product.images) {
        product.images.forEach(img => {
          if (img.url) allMediaUrls.push(img.url);
        });
      }
      if (product.digitalProduct?.fileUrl) {
        allMediaUrls.push(product.digitalProduct.fileUrl);
      }
    });

    // Delete all media from Cloudinary
    if (allMediaUrls.length > 0) {
      try {
        await deleteMultipleFromCloudinary(allMediaUrls);
        console.log(`Deleted ${allMediaUrls.length} files from Cloudinary`);
      } catch (deleteError) {
        console.error('Cloudinary deletion error:', deleteError);
      }
    }

    // Permanently delete all associated data
    await ProductModel.deleteMany({ store: storeId }).session(session);
    await PromotionTrackingModel.deleteMany({ store: storeId }).session(session);
    await InventoryHistoryModel.deleteMany({ store: storeId }).session(session);
    await StoreAnalyticsModel.deleteMany({ store: storeId }).session(session);
    await WhatsAppIntegrationModel.deleteMany({ store: storeId }).session(session);
    await StoreModel.findByIdAndDelete(storeId).session(session);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: 'Store permanently deleted',
      data: {
        _id: storeId,
        name: store.name
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Permanent store deletion error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to permanently delete store',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

