// routes/store.routes.js
import express from 'express';
import { upload } from '../middleware/upload.middleware.js';
import { createStore } from '../controllers/create-store.controller.js'
import { getUserStores } from '../controllers/get-stores.controller.js'
import { getStoreById } from '../controllers/get-store-byid.controller.js'

const router = express.Router();

// Create store (with file upload for logo)
router.post('/', upload.single('logo'), createStore);

// Get user's stores
router.get('/', getUserStores);

// Get specific store
router.get('/:storeId', getStoreById);

export default router;