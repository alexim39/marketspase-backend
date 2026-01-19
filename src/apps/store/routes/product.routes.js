// routes/product.routes.js
import express from 'express';
import multer from 'multer';
import { createProduct } from '../controllers/product/create-product.controller.js';
/* import { getProduct } from '../controllers/product/get-product.controller.js';
import { updateProduct } from '../controllers/product/update-product.controller.js';
import { deleteProduct } from '../controllers/product/delete-product.controller.js';
import { getStoreProducts } from '../controllers/product/get-store-products.controller.js';
import { searchProducts } from '../controllers/product/search-products.controller.js';
import { updateInventory } from '../controllers/product/update-inventory.controller.js';
import { updatePrice } from '../controllers/product/update-price.controller.js';
import { uploadImages } from '../controllers/product/upload-images.controller.js';
import { setMainImage } from '../controllers/product/set-main-image.controller.js';
import { deleteImage } from '../controllers/product/delete-image.controller.js';
import { reorderImages } from '../controllers/product/reorder-images.controller.js'; */

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    // Allow images and PDFs for digital products
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
    }
  }
});


// Product CRUD routes
router.post('/:storeId/:userId/create', 
  upload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'digitalFile', maxCount: 1 }
  ]), 
  createProduct
);


/* router.get('/:storeId/products/:productId', getProduct);
router.put('/:storeId/products/:productId', updateProduct);
router.delete('/:storeId/products/:productId', deleteProduct);
router.get('/:storeId/products', getStoreProducts);
router.get('/:storeId/products/search', searchProducts);

// Product management routes
router.patch('/:storeId/products/:productId/inventory', updateInventory);
router.patch('/:storeId/products/:productId/price', updatePrice);

// Image management routes
router.post('/:storeId/products/:productId/images', 
  upload.array('images', 10), 
  uploadImages
);
router.patch('/:storeId/products/:productId/images/main', setMainImage);
router.delete('/:storeId/products/:productId/images/:imageIndex', deleteImage);
router.patch('/:storeId/products/:productId/images/reorder', reorderImages); */

export default router;