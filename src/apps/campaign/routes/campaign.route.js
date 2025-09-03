import express from 'express';
import { 
    createCampaign, 
    getAUserCampaigns,
    getCampaignsByStatus,
    applyForCampaign,
    getAllCampaigns,
    getCampaignById,
    updateCampaignStatus
} from '../controllers/campaign.controller.js'
import { campaignUpload } from '../services/upload.js';
import {   getUserPromotions, submitProof, getProofDetails } from '../controllers/promotion.controller.js'
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

const CampaignRouter = express.Router();


// get campaigns by status (e.g., /campaign?status=active)
CampaignRouter.get('/', getCampaignsByStatus);

// create campaign payment
CampaignRouter.post('/create', campaignUpload.single('media'), createCampaign);

// POST /api/promotions/submit-proof
CampaignRouter.post('/promotions/submit-proof', upload.array('proofImages', 3), submitProof);

// admin - get all campaigns
CampaignRouter.get('/campaigns', getAllCampaigns);




/* Dynamic Routes */

// get all campaigns for an advertiser
CampaignRouter.get('/user/:userId', getAUserCampaigns);

// get a campaign by id
CampaignRouter.get('/:id', getCampaignById);

//
CampaignRouter.get('/promotions/user/:userId', getUserPromotions);

// apply for a campaign
CampaignRouter.post('/:campaignId/apply', applyForCampaign);

// Admin - update campaign status: approve, reject, pause,
CampaignRouter.patch('/:id/status', updateCampaignStatus);

// GET /api/promotions/proof/:promotionId
CampaignRouter.get('/promotions/proof/:promotionId', getProofDetails);


export default CampaignRouter;