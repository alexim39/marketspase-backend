// store.routes.js
import express from 'express';
import {
  getStoreByLink,
  getStorefrontProducts,
  getStoreCategories,
  incrementStoreViews,
  getStoreAnalytics,
  searchStores,
  getTrendingStores,
  checkStoreLinkAvailability,
  trackStoreInteraction,
  getStoreVerificationStatus
} from '../controllers/storefront.controller.js';

const router = express.Router();

// Public routes
router.get('/link/:storeLink', getStoreByLink);
router.get('/:storeId/products', getStorefrontProducts);
router.get('/:storeId/categories', getStoreCategories);
router.post('/:storeId/views', incrementStoreViews);
router.get('/search', searchStores);
router.get('/trending', getTrendingStores);
router.get('/check-link/:storeLink', checkStoreLinkAvailability);
router.post('/:storeId/interactions', trackStoreInteraction);
router.get('/:storeId/verification-status', getStoreVerificationStatus);

// Protected routes (store owners)
router.get('/:storeId/analytics', getStoreAnalytics);

export default router;