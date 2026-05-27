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
import {
  createProductReview,
  deleteProductReview,
  getCurrentUserProductReview,
  reportProductReview,
  toggleReviewHelpful,
  updateProductReview
} from '../../controllers/storefront/product-review.controller.js'
import { getRelatedProducts } from '../../controllers/storefront/get-related-products.controller.js'
import { getStoreById } from '../../controllers/storefront/get-store-by-id.controller.js'
import { authenticate } from '../../../../shared/middleware/auth.middleware.js';
import { requireAdmin } from '../../../../shared/middleware/authorization.middleware.js';
import { apiLimiter } from '../../../../shared/middleware/rate-limit.middleware.js';
import {
  confirmStorefrontDelivery,
  confirmStorefrontPayment,
  createStorefrontOrder,
  getMarketerOrders,
  getPromoterOrders,
  getStorefrontReleaseRequests,
  getStoreOrders,
  getStorefrontOrder,
  reviewStorefrontDeliveryRelease
} from '../../controllers/storefront/storefront-order.controller.js'
import {
  getMarketerCustomerDetail,
  getMarketerCustomers,
  updateMarketerCustomerMeta,
} from '../../controllers/storefront/storefront-customer.controller.js';
import { subscribeStoreSubscriber } from '../../controllers/storefront/store-subscriber.controller.js';

const router = express.Router();

// 1. Static/Global Search Routes (Move these to the TOP)
router.get('/search', searchStores);
router.get('/trending', getTrendingStores);

// 2. Specific Product Routes
router.get('/products/:productId/detail', getProductById);
router.get('/products/:productId/reviews', getProductReviews);
router.get('/products/:productId/reviews/me', authenticate, getCurrentUserProductReview);
router.post('/products/:productId/reviews', authenticate, createProductReview);
router.put('/reviews/:reviewId', authenticate, updateProductReview);
router.delete('/reviews/:reviewId', authenticate, deleteProductReview);
router.post('/reviews/:reviewId/helpful', authenticate, toggleReviewHelpful);
router.post('/reviews/:reviewId/report', authenticate, reportProductReview);
router.get('/products/:productId/related', getRelatedProducts);

// 2b. Storefront checkout and order lifecycle
router.post('/orders', createStorefrontOrder);
router.get('/orders/release-requests', authenticate, requireAdmin, getStorefrontReleaseRequests);
router.get('/orders/store/:storeId', authenticate, getStoreOrders);
router.get('/orders/marketer/:marketerId', authenticate, getMarketerOrders);
router.get('/orders/promoter/:promoterId', authenticate, getPromoterOrders);
router.get('/customers/marketer/:marketerId', authenticate, getMarketerCustomers);
router.get('/customers/marketer/:marketerId/detail', authenticate, getMarketerCustomerDetail);
router.patch('/customers/marketer/:marketerId/meta', authenticate, updateMarketerCustomerMeta);
router.get('/orders/:orderId', getStorefrontOrder);
router.post('/orders/:orderId/confirm-payment', confirmStorefrontPayment);
router.post('/orders/:orderId/confirm-delivery', authenticate, confirmStorefrontDelivery);
router.post('/orders/:orderId/release-review', authenticate, requireAdmin, reviewStorefrontDeliveryRelease);

// 3. Specific Store Routes
router.get('/store/:storeId', getStoreById);
router.get('/check-link/:storeLink', checkStoreLinkAvailability);
router.get('/link/:storeLink', getStoreByLink);

// 4. Dynamic Store ID Routes (Keep these at the BOTTOM)
router.get('/:storeId/products', getStorefrontProducts);
router.get('/:storeId/categories', getStoreCategories);
router.post('/:storeId/views', incrementStoreViews);
router.post('/:storeId/interactions', trackStoreInteraction);
router.post('/:storeId/subscribers', apiLimiter, subscribeStoreSubscriber);
router.get('/:storeId/verification-status', getStoreVerificationStatus);
router.get('/:storeId/analytics', getStoreAnalytics);

export default router;
