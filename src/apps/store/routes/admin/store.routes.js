import express from 'express';
import { StoreController } from '../../controllers/admin/store.controller.js';
//import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public routes (if any)
// router.get('/public/stores', StoreController.getPublicStores);

// Protected routes - require authentication
//router.use(authenticate);

// Store management routes
router.get('/stores',  StoreController.getStores);
router.get('/statistics',  StoreController.getStoreStatistics);
router.get('/categories',  StoreController.getStoreCategories);
router.get('/owners',  StoreController.getStoreOwners);
router.post('/export/:format',  StoreController.exportStores);
router.post('/bulk-update',  StoreController.bulkUpdateStores);

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
  req.query.owner = req.user.id;
  await StoreController.getStores(req, res);
});

router.post('/stores',  StoreController.createStore);
router.put('/stores/:id',  async (req, res) => {
  // Check if user owns the store
  const store = await StoreModel.findById(req.params.id);
  if (!store) {
    return res.status(404).json({ success: false, message: 'Store not found' });
  }
  
  if (store.owner.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'You do not have permission to update this store' 
    });
  }
  
  await StoreController.updateStore(req, res);
});

export default router;