// services/product-promotion.service.js
import { ProductModel, PromotionTrackingModel } from "../models/promotion/index.js";
import mongoose from "mongoose";

export class ProductPromotionService {
  /**
   * Publish multiple products for promotion
   */
  async publishProductsForPromotion(productIds, storeId, userId) {
    try {
      //console.log('Publishing products:', { productIds, storeId, userId });
      
      const products = await ProductModel.find({
        _id: { $in: productIds },
        store: storeId,
        isDeleted: false
      });

      if (products.length === 0) {
        throw new Error("No valid products found to publish");
      }

      const results = {
        totalProcessed: products.length,
        published: 0,
        skipped: 0,
        failed: [],
        details: [],
        trackingUpdated: 0,
        trackingCreated: 0
      };

      for (const product of products) {
        try {

          if (!product.isActive) {
            results.skipped++;
            results.details.push({
              productId: product._id,
              name: product.name,
              status: "skipped",
              reason: "Product is inactive"
            });
            continue;
          }

          if (product.quantity <= 0 && product.manageStock) {
            results.skipped++;
            results.details.push({
              productId: product._id,
              name: product.name,
              status: "skipped",
              reason: "Product is out of stock"
            });
            continue;
          }

          // Update product publication status
          const beforeUpdate = { ...product.toObject() };
          
          product.isPublished = true;
          product.publishedAt = new Date();
          product.publishedBy = userId;
          product.promotionStartDate = new Date();
          product.promotionEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          await product.save();
          
          // Verify the save worked
          const verifyProduct = await ProductModel.findById(product._id);
          // console.log('Verified product after save:', {
          //   id: verifyProduct._id,
          //   isPublished: verifyProduct.isPublished,
          //   publishedAt: verifyProduct.publishedAt
          // });

          // Create or update promotion tracking
          const trackingResult = await this.createPromotionTracking(product, userId);
          
          if (trackingResult?.wasUpdated) {
            results.trackingUpdated++;
          } else if (trackingResult?.wasCreated) {
            results.trackingCreated++;
          }

          results.published++;
          results.details.push({
            productId: product._id,
            name: product.name,
            status: "published",
            wasPreviouslyPublished: beforeUpdate.isPublished
          });
        } catch (error) {
          //console.error(`Error processing product ${product._id}:`, error);
          results.failed.push({
            productId: product._id,
            name: product.name,
            error: error.message
          });
        }
      }

      //console.log('Publishing results:', results);
      return results;
    } catch (error) {
      //console.error('Publishing error:', error);
      throw new Error(`Failed to publish products: ${error.message}`);
    }
  }

  /**
   * Unpublish products from promotion
   */
  async unpublishProducts(productIds, storeId) {
    try {
      //console.log('Unpublishing products:', { productIds, storeId });

      // First, get the products to be unpublished
      const products = await ProductModel.find({
        _id: { $in: productIds },
        store: storeId,
        isDeleted: false,
        isPublished: true
      });

      // console.log('Found products to unpublish:', products.map(p => ({
      //   id: p._id,
      //   name: p.name,
      //   isPublished: p.isPublished
      // })));

      // Update products - set isPublished to false
      const productUpdateResult = await ProductModel.updateMany(
        {
          _id: { $in: productIds },
          store: storeId,
          isPublished: true
        },
        {
          $set: {
            isPublished: false,
            promotionEndDate: new Date()
          },
          $unset: {
            publishedBy: 1 // Optional: remove the publishedBy reference
          }
        }
      );

      //console.log('Product update result:', productUpdateResult);

      // Also deactivate related promotion tracking records
      let trackingUpdateResult = { modifiedCount: 0, matchedCount: 0 };
      
      if (products.length > 0) {
        trackingUpdateResult = await PromotionTrackingModel.updateMany(
          {
            product: { $in: productIds },
            store: storeId,
            isActive: true
          },
          {
            $set: {
              isActive: false,
              endDate: new Date()
            }
          }
        );
        
        //console.log('Tracking update result:', trackingUpdateResult);
      }

      const result = {
        modifiedCount: productUpdateResult.modifiedCount,
        matchedCount: productUpdateResult.matchedCount,
        trackingModifiedCount: trackingUpdateResult.modifiedCount,
        products: products.map(p => ({
          id: p._id,
          name: p.name,
          wasPublished: true
        }))
      };

      return result;
    } catch (error) {
      //console.error('Unpublish error:', error);
      throw new Error(`Failed to unpublish products: ${error.message}`);
    }
  }

  /**
   * Create promotion tracking for a product
   */
  async createPromotionTracking(product, userId) {
    try {
      const now = new Date();
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      // Try to find existing tracking
      let existing = await PromotionTrackingModel.findOne({
        product: product._id,
        promoter: userId
      });
      
      let wasUpdated = false;
      let wasCreated = false;
      
      if (existing) {
        // Update existing
        existing.isActive = true;
        existing.isApproved = true;
        existing.startDate = now;
        existing.endDate = endDate;
        existing.metadata = {
          ...existing.metadata,
          campaignName: `Product Promotion - ${product.name}`,
          lastPublishedAt: now,
          reactivationCount: (existing.metadata?.reactivationCount || 0) + 1
        };
        
        await existing.save();
        wasUpdated = true;
        //console.log(`Updated existing tracking for product ${product._id}`);
      } else {
        // Create new
        const trackingData = {
          product: product._id,
          promoter: userId,
          store: product.store,
          uniqueCode: `${product._id.toString().slice(-6)}-${Date.now().toString(36)}`,
          // uniqueCode: `PROMO-${product._id.toString().slice(-6)}-${Date.now().toString(36)}`,
          uniqueId: `${userId.toString().substring(0, 4)}-${product._id.toString().substring(0, 4)}-${Date.now().toString(36)}`,
          commissionRate: 10,
          commissionType: 'percentage',
          isActive: true,
          isApproved: true,
          startDate: now,
          endDate: endDate,
          metadata: {
            campaignName: `Product Promotion - ${product.name}`,
            notes: "Auto-generated from bulk publish action",
            publishedAt: now,
            reactivationCount: 0
          }
        };

        existing = new PromotionTrackingModel(trackingData);
        await existing.save();
        wasCreated = true;
        //console.log(`Created new tracking for product ${product._id}`);
      }
      
      return {
        tracking: existing,
        wasUpdated,
        wasCreated
      };
    } catch (error) {
      //console.error("Error in promotion tracking:", error);
      return null;
    }
  }

  /**
   * Get published products for a store
   */
  async getPublishedProducts(storeId, options = {}) {
    const { page = 1, limit = 20, includeInactive = false } = options;
    
    const query = {
      store: new mongoose.Types.ObjectId(storeId),
      isPublished: true,
      isDeleted: false
    };

    if (!includeInactive) {
      query.isActive = true;
    }

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      ProductModel.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ publishedAt: -1 })
        .populate('publishedBy', 'name email')
        .lean(),
      ProductModel.countDocuments(query)
    ]);

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

export default new ProductPromotionService();