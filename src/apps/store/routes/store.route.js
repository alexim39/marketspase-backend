// routes/store.routes.js
import express from 'express';
import { upload } from '../middleware/upload.middleware.js';
import { createStore } from '../controllers/create-store.controller.js'
import { updateStore } from '../controllers/edit-store.controller.js'
import { getUserStores } from '../controllers/get-stores.controller.js'
import { getStoreById } from '../controllers/get-store-byid.controller.js'
import { setDefaultStore } from '../controllers/set-default-store.controller.js'
import { getStoreProducts } from '../controllers/store-products.controller.js'

const router = express.Router();

// Create store (with file upload for logo)
router.post('/', upload.single('logo'), createStore);

// Get user's stores
router.get('/', getUserStores);

// Get specific store
router.get('/:storeId', getStoreById);

// Get specific store products
router.get('/:storeId/products', getStoreProducts);

// Update store
router.patch('/:id', upload.single('logo'), updateStore);

// Set default store (PATCH /api/stores/:storeId/set-default)
router.patch("/:storeId/set-default", setDefaultStore);

export default router;