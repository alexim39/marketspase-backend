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

const router = express.Router();


// Get all products in product collection for promoter to browse
//router.get('/', getPromoterProducts);

// Product listing routes
router.route("/list").get(getPromoterProducts);
//
router.route("/trending").get(getTrendingProducts);

router.route("/high-commission").get(getHighCommissionProducts);

router.route("/recommended").get(getRecommendedProducts);

// creaate product
router.post(
  "/:storeId/:userId/create",
  cloudinaryMediaUpload.fields([
    { name: "images", maxCount: 5 },
    { name: "digitalFile", maxCount: 1 },
  ]),
  createProduct,
);

// update product
router.put(
  "/:storeId/:userId/:productId",
  cloudinaryMediaUpload.fields([
    { name: "images", maxCount: 5 },
    { name: "digitalFile", maxCount: 1 },
  ]),
  updateProduct,
);

// DELETE route - soft delete
//router.delete('/:storeId/:userId/:productId', deleteProduct);

// Permanent delete route (use with caution)
router.delete(
  '/:storeId/:userId/:productId/permanent',
  permanentDeleteProduct
);


// Single product routes
router.route("/:id").get(getPromoterProductDetails);

router.route("/:id/stats").get(getProductPromotionStatsController);

router.route("/:id/view").post(trackProductView);

router.route("/:id/generate-link").post(generatePromotionLink);


export default router;
