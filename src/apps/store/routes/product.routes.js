// routes/product.routes.js
import express from 'express';
import multer from 'multer';
import { createProduct } from '../controllers/product/create-product.controller.js';
import {getPromoterProducts } from '../controllers/product/get-promoter-products.controller.js';
import {getPromoterProductDetails } from '../controllers/product/get-promoter-product-details.controller.js';
import {getProductPromotionStatsController } from '../controllers/product/get-product-promo-stats.controller.js';
import {trackProductView } from '../controllers/product/track-product-view.controller.js';
import {getTrendingProducts } from '../controllers/product/get-trending-products.controller.js';
import {getHighCommissionProducts } from '../controllers/product/get-high-comm-products.controller.js';
import {getRecommendedProducts } from '../controllers/product/get-recomm-product.controller.js';
import {generatePromotionLink } from '../controllers/product/generate-product-link.controller.js';


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

// Get all products in product collection for promoter to browse
//router.get('/', getPromoterProducts);



// Product listing routes
router.route('/list').get(getPromoterProducts);
//
router.route('/trending').get(getTrendingProducts);

router.route('/high-commission').get(getHighCommissionProducts);

router.route('/recommended').get(getRecommendedProducts);

// Single product routes
router.route('/:id').get(getPromoterProductDetails);

router.route('/:id/stats').get(getProductPromotionStatsController);

router.route('/:id/view').post(trackProductView);

router.route('/:id/generate-link').post(generatePromotionLink);


export default router;