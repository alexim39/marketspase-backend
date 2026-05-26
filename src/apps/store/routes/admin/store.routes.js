import express from 'express';
import { StoreController } from '../../controllers/admin/store.controller.js';
import { StoreReviewAdminController } from '../../controllers/admin/review.controller.js';
import { StoreModel } from '../../models/store/index.js';
import { deleteAdminSubscriberHandler, getAdminSubscribers } from '../../controllers/admin/store-subscriber.controller.js';
import { authenticate } from '../../../../shared/middleware/auth.middleware.js';
import { requireAdmin } from '../../../../shared/middleware/authorization.middleware.js';
import {
  getStorefrontAnalyticsCategoriesHandler,
  getStorefrontAnalyticsOverviewHandler,
  getStorefrontProductPromoterBreakdownHandler,
  getStorefrontPromoterProductBreakdownHandler,
  searchStorefrontAnalyticsProductsHandler,
  searchStorefrontAnalyticsStoresHandler,
} from '../../controllers/admin/storefront-analytics.controller.js';
import {
  getAdminBuyerDetail,
  getAdminBuyers,
  updateAdminBuyerMeta,
} from '../../controllers/storefront/storefront-customer.controller.js';

const router = express.Router();

// Public routes (if any)
// router.get('/public/stores', StoreController.getPublicStores);

// Protected routes - require authentication
router.use(authenticate);
router.use(requireAdmin);

// Store management routes
router.get('/stores',  StoreController.getStores);
router.get('/statistics',  StoreController.getStoreStatistics);
router.get('/categories',  StoreController.getStoreCategories);
router.get('/owners',  StoreController.getStoreOwners);
router.get('/buyers', getAdminBuyers);
router.get('/buyers/detail', getAdminBuyerDetail);
router.patch('/buyers/meta', updateAdminBuyerMeta);
router.get('/subscribers', getAdminSubscribers);
router.delete('/subscribers/:subscriberId', deleteAdminSubscriberHandler);
router.post('/export/:format',  StoreController.exportStores);
router.post('/bulk-update',  StoreController.bulkUpdateStores);
router.get('/reviews', StoreReviewAdminController.getReviews);
router.patch('/reviews/:reviewId/moderate', StoreReviewAdminController.moderateReview);

// Storefront analytics (holistic, cross-store)
router.get('/analytics/overview', getStorefrontAnalyticsOverviewHandler);
router.get('/analytics/products', searchStorefrontAnalyticsProductsHandler);
router.get('/analytics/categories', getStorefrontAnalyticsCategoriesHandler);
router.get('/analytics/stores', searchStorefrontAnalyticsStoresHandler);
router.get('/analytics/product-promoters', getStorefrontProductPromoterBreakdownHandler);
router.get('/analytics/promoter-products', getStorefrontPromoterProductBreakdownHandler);

// Store-specific routes
router.get('/:id',  StoreController.getStoreById);
router.post('/',  StoreController.createStore);
router.put('/:id',  StoreController.updateStore);
router.patch('/:id/verification',  StoreController.toggleStoreVerification);
router.patch('/:id/active',  StoreController.toggleStoreActive);
router.patch('/:id/tier',  StoreController.upgradeStoreTier);
router.delete('/:id',  StoreController.deleteStore);

// Store analytics routes
router.get('/:id/analytics',  StoreController.getStoreAnalytics);
router.get('/:id/products',  StoreController.getStoreProducts);

// Store owner routes (for marketers/admins)
router.get('/stores/my-stores',  async (req, res) => {
  // Redirect to controller method for user's stores
  req.query.owner = req.userId;
  await StoreController.getStores(req, res);
});

router.post('/stores',  StoreController.createStore);
router.put('/stores/:id',  async (req, res) => {
  // Check if user owns the store
  const store = await StoreModel.findById(req.params.id);
  if (!store) {
    return res.status(404).json({ success: false, message: 'Store not found' });
  }
  
  if (store.owner.toString() !== String(req.userId || '') && req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'You do not have permission to update this store' 
    });
  }
  
  await StoreController.updateStore(req, res);
});

export default router;
