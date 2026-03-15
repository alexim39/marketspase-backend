// routes/product.routes.js
import express from "express";
import { cloudinaryMediaUpload } from "./../../../../services/cloudinary.service.js";
import { createProduct } from "../../controllers/product/create-product.controller.js";
import { updateProduct } from "../../controllers/product/update-product.controller.js";
import { getPromoterProducts } from "../../controllers/product/get-promoter-products.controller.js";
import { getPromoterProductDetails } from "../../controllers/product/get-promoter-product-details.controller.js";
import { getProductPromotionStatsController } from "../../controllers/product/get-product-promo-stats.controller.js";
import { trackProductView } from "../../controllers/product/track-product-view.controller.js";
import { getTrendingProducts } from "../../controllers/product/get-trending-products.controller.js";
import { getHighCommissionProducts } from "../../controllers/product/get-high-comm-products.controller.js";
import { getRecommendedProducts } from "../../controllers/product/get-recomm-product.controller.js";
import { generatePromotionLink } from "../../controllers/product/generate-product-link.controller.js";
import { permanentDeleteProduct } from "../../controllers/product/delete-product.controller.js";
import ProductPromotionController from "../../controllers/product/product-promotion.controller.js";

const router = express.Router();

// =========== PUBLIC/PROMOTER ROUTES (NO STORE ID REQUIRED) ===========
// These should come first as they don't have storeId parameters

// Get all products in product collection for promoter to browse
router.route("/list").get(getPromoterProducts);

router.route("/trending").get(getTrendingProducts);

router.route("/high-commission").get(getHighCommissionProducts);

router.route("/recommended").get(getRecommendedProducts);

// =========== STORE-SPECIFIC ROUTES (WITH STOREID AND USERID) ===========
// These routes have specific actions and should come before parameterized routes

// Create product
router.post("/:storeId/:userId/create", 
  cloudinaryMediaUpload.fields([{ name: "images", maxCount: 5 }, { name: "digitalFile", maxCount: 1 }]), 
  createProduct
);

// IMPORTANT: BULK PUBLISH ROUTE - Must come before /:id routes
router.post("/:storeId/:userId/publish", 
  ProductPromotionController.publishProducts
);

// Bulk unpublish products
router.post("/:storeId/unpublish", 
  ProductPromotionController.unpublishProducts
);

router.post("/:storeId/:productId/unpublish", 
  ProductPromotionController.unpublishSingleProduct
);

// Get published products for a store
router.get("/:storeId/published", 
  ProductPromotionController.getPublishedProducts
);

// Update product
router.put("/:storeId/:userId/:productId", 
  cloudinaryMediaUpload.fields([{ name: "images", maxCount: 5 }, { name: "digitalFile", maxCount: 1 }]), 
  updateProduct
);

// Permanent delete route (use with caution)
router.delete("/:storeId/:userId/:productId/permanent", 
  permanentDeleteProduct
);

// =========== SINGLE PRODUCT ROUTES (BY ID) ===========
// These parameterized routes should come LAST to avoid catching specific routes above

// Get single product details
router.route("/:id").get(getPromoterProductDetails);

// Get product promotion stats
router.route("/:id/stats").get(getProductPromotionStatsController);

// Track product view
router.route("/:id/view").post(trackProductView);

// Generate promotion link
router.route("/:id/generate-link").post(generatePromotionLink);

export default router;