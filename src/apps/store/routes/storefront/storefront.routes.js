// store.routes.js
import express from 'express';
import {
  incrementStoreViews,
  getStoreAnalytics,
  trackStoreInteraction,
  getStoreByLink
} from '../../controllers/storefront/storefront.controller.js';
import { getStorefrontProducts } from '../../controllers/storefront/get-storefront-products.controller.js'
import { getStoreCategories } from '../../controllers/storefront/get-store-categories.controller.js'
import { searchStores } from '../../controllers/storefront/search-store.controller.js'
import { getTrendingStores } from '../../controllers/storefront/get-trending-store.controller.js'
import { checkStoreLinkAvailability } from '../../controllers/storefront/check-storelink-availability.controller.js'
import { getStoreVerificationStatus } from '../../controllers/storefront/get-store-verification-status.js'
import { getProductById } from '../../controllers/storefront/get-product-by-id.controller.js'
import { getProductReviews } from '../../controllers/storefront/get-product-reviews.controller.js'
import { getRelatedProducts } from '../../controllers/storefront/get-related-products.controller.js'
import { getStoreById } from '../../controllers/storefront/get-store-by-id.controller.js'

const router = express.Router();

// 1. Static/Global Search Routes (Move these to the TOP)
router.get('/search', searchStores);
router.get('/trending', getTrendingStores);

// 2. Specific Product Routes
router.get('/products/:productId/detail', getProductById);
router.get('/products/:productId/reviews', getProductReviews);
router.get('/products/:productId/related', getRelatedProducts);

// 3. Specific Store Routes
router.get('/store/:storeId', getStoreById);
router.get('/check-link/:storeLink', checkStoreLinkAvailability);
router.get('/link/:storeLink', getStoreByLink);

// 4. Dynamic Store ID Routes (Keep these at the BOTTOM)
router.get('/:storeId/products', getStorefrontProducts);
router.get('/:storeId/categories', getStoreCategories);
router.post('/:storeId/views', incrementStoreViews);
router.post('/:storeId/interactions', trackStoreInteraction);
router.get('/:storeId/verification-status', getStoreVerificationStatus);
router.get('/:storeId/analytics', getStoreAnalytics);

export default router;
