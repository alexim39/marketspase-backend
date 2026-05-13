// controllers/product/product-promotion.controller.js
import ProductPromotionService from "../../services/product-promotion.service.js";
import { StoreModel } from "../../models/store/index.js";

export class ProductPromotionController {
  constructor() {
    this.publishProducts = this.publishProducts.bind(this);
    this.unpublishProducts = this.unpublishProducts.bind(this);
    this.unpublishSingleProduct = this.unpublishSingleProduct.bind(this);
    this.getPublishedProducts = this.getPublishedProducts.bind(this);
  }

  async ensureStoreOwnership(storeId, req, res) {
    const store = await StoreModel.findById(storeId).select('owner');
    if (!store) {
      res.status(404).json({
        success: false,
        message: 'Store not found'
      });
      return null;
    }

    if (req.user?.role !== 'admin' && store.owner?.toString() !== req.userId) {
      res.status(403).json({
        success: false,
        message: 'You are not allowed to manage promotion settings for this store'
      });
      return null;
    }

    return store;
  }

  /**
   * Publish products for promotion
   */
  async publishProducts(req, res) {
    try {
      const { storeId } = req.params;
      const { productIds } = req.body;

      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please provide an array of product IDs"
        });
      }

      const store = await this.ensureStoreOwnership(storeId, req, res);
      if (!store) {
        return;
      }

      const result = await ProductPromotionService.publishProductsForPromotion(
        productIds,
        storeId,
        req.userId
      );

      return res.status(200).json({
        success: true,
        message: `Successfully published ${result.published} out of ${result.totalProcessed} products`,
        data: result
      });
    } catch (error) {
     // console.error("Publish products error:", error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Unpublish products from promotion
   */
  async unpublishProducts(req, res) {
    try {
      const { storeId } = req.params;
      const { productIds } = req.body;

      //console.log('Unpublishing products:', { storeId, productIds });

      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please provide an array of product IDs"
        });
      }

      const store = await this.ensureStoreOwnership(storeId, req, res);
      if (!store) {
        return;
      }

      const result = await ProductPromotionService.unpublishProducts(
        productIds,
        storeId
      );

      return res.status(200).json({
        success: true,
        message: `Successfully unpublished ${result.modifiedCount} out of ${result.matchedCount} products`,
        data: result
      });
    } catch (error) {
      //console.error("Unpublish products error:", error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Unpublish a single product
   */
  async unpublishSingleProduct(req, res) {
    try {
      const { storeId, productId } = req.params;

      //console.log('Unpublishing single product:', { storeId, productId });

      const store = await this.ensureStoreOwnership(storeId, req, res);
      if (!store) {
        return;
      }

      const result = await ProductPromotionService.unpublishProducts(
        [productId],
        storeId
      );

      if (result.modifiedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Product not found or already unpublished"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Product unpublished successfully",
        data: result
      });
    } catch (error) {
      //console.error("Unpublish single product error:", error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get published products for a store
   */
  async getPublishedProducts(req, res) {
    try {
      const { storeId } = req.params;
      const { page, limit, includeInactive } = req.query;

      const store = await this.ensureStoreOwnership(storeId, req, res);
      if (!store) {
        return;
      }

      const result = await ProductPromotionService.getPublishedProducts(storeId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        includeInactive: includeInactive === 'true'
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("Get published products error:", error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new ProductPromotionController();
