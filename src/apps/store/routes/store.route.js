// routes/store.routes.js
import express from 'express';
import { StoreController } from '../controllers/store.controller.js';
import { upload } from '../middleware/upload.middleware.js';

const router = express.Router();
const storeController = new StoreController();

// Create store (with file upload for logo)
router.post(
  '/',
  upload.single('logo'), // Field name matches Angular form
  storeController.createStore.bind(storeController)
);

// Get user's stores
router.get('/', storeController.getUserStores.bind(storeController));

// Get specific store
router.get('/:storeId', storeController.getStoreById.bind(storeController));

export default router;