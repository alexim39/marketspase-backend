import express from 'express';
import { 
    getPromotionById,
    getUserPromotions,
    downloadPromotion,
} from '../controllers/promotion.controller.js'
import { submitProof } from '../controllers/submit-proof.controler.js'

import multer from 'multer';


const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory for cloud upload
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 3 // Max 3 files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});


const PromoterRouter = express.Router();

// get a user promotions
PromoterRouter.get('/user/:userId', getUserPromotions);
// get promotion
PromoterRouter.get('/:id/:userId', getPromotionById);
/**
 * @route POST /api/promotions/download
 * @description Allows a promoter to register for a campaign and download the media.
 * @access Private (Promoter only)
 */
PromoterRouter.post('/download', downloadPromotion);
// POST /api/promotions/submit-proof
PromoterRouter.post('/submit-proof/:promoterId', upload.array('proofImages', 3), submitProof);


export default PromoterRouter;