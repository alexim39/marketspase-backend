// routes/store.routes.js
import express from 'express';
import { upload } from '../../middleware/upload.middleware.js';
import { createStore } from '../../controllers/store/create-store.controller.js'
import { updateStore } from '../../controllers/store/edit-store.controller.js'
import { getUserStores } from '../../controllers/store/get-stores.controller.js'
import { getStoreById } from '../../controllers/store/get-store-byid.controller.js'
import { setDefaultStore } from '../../controllers/store/set-default-store.controller.js'
import { getStoreProducts } from '../../controllers/store/store-products.controller.js'
import { getStoreProduct } from '../../controllers/store/store-product.controller.js'
import { permanentDeleteStore } from '../../controllers/store/delete-store.controller.js'
import { getOwnerSubscribers } from '../../controllers/store/store-subscriber.controller.js';
import {
  getMarketerProductPromoterBreakdownHandler,
  getMarketerPromotedProductsAnalyticsOverviewHandler,
  searchMarketerPromotedProductsProductOptionsHandler,
  searchMarketerPromotedProductsPromoterOptionsHandler,
} from '../../controllers/store/promoted-products-analytics.controller.js';
import PromoterStoreListRouter from './promoter-store-list.route.js';
import { authenticate } from '../../../../shared/middleware/auth.middleware.js';
import { galleryUpload } from '../../middleware/gallery-upload.middleware.js';
import { uploadGallery, listGallery, deleteGalleryItem, updateStoreProfile } from '../../controllers/store/gallery.controller.js';
import { StoreModel } from '../../models/store/store.model.js';

const router = express.Router();

// Mount store routes
router.use('/promoter-store-list', PromoterStoreListRouter);

// Public store profile (no auth required)
router.get('/:storeId/public-profile', async (req, res) => {
  try {
    const store = await StoreModel.findById(req.params.storeId)
      .select('gallery certifications businessHours serviceAreas faqs')
      .lean();
    if (!store) return res.status(404).json({ success: false, message: 'Store not found' });
    return res.status(200).json({ success: true, data: store });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.use(authenticate);

// Create store (with file upload for logo)
router.post('/', upload.single('logo'), createStore);

// Get user's stores
router.get('/', getUserStores);

// Store email subscribers (owner only)
router.get('/subscribers', getOwnerSubscribers);

// Marketer promoted products analytics (owner scoped)
router.get('/analytics/promoted-products/overview', getMarketerPromotedProductsAnalyticsOverviewHandler);
router.get('/analytics/promoted-products/product-promoters', getMarketerProductPromoterBreakdownHandler);
router.get('/analytics/promoted-products/options/products', searchMarketerPromotedProductsProductOptionsHandler);
router.get('/analytics/promoted-products/options/promoters', searchMarketerPromotedProductsPromoterOptionsHandler);

// DELETE route - soft delete
//router.delete('/:storeId/:userId', deleteStore);

// Optional: Permanent delete route
router.delete('/:storeId/:userId/permanent', permanentDeleteStore);

// Get specific store
router.get('/:storeId', getStoreById);

// Get specific store products (product listing)
router.get('/:storeId/products', getStoreProducts);

// Get specific store product (single product)
router.get('/:storeId/products/:productId', getStoreProduct);

// Update store
router.patch('/:id', upload.single('logo'), updateStore);

// Set default store (PATCH /api/stores/:storeId/set-default)
router.patch("/:storeId/set-default", setDefaultStore);

// Gallery management
router.post('/:storeId/gallery', galleryUpload.array('media', 5), uploadGallery);
router.get('/:storeId/gallery', listGallery);
router.delete('/:storeId/gallery/:mediaId', deleteGalleryItem);

// Store profile (business hours, service areas, FAQs, certifications)
router.patch('/:storeId/profile', updateStoreProfile);

export default router;
