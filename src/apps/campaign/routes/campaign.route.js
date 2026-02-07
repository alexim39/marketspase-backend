import express from 'express';
import { acceptCampaign } from '../controllers/accept-campaign.controller.js'
import { createCampaign } from '../controllers/create-campaign.controller.js'
import { saveCampaign } from '../controllers/save-campaign.controller.js'
import { EditCampaign, UpdateCampaignPartial  } from '../controllers/edit-campaign.controller.js'
import { campaignUpload } from '../services/campaign-upload.service.js';
import { getProofDetails, } from '../controllers/get-proof-details.controller.js'
import { getCampaignsByStatusAndUserId } from '../controllers/get-by-status-and-userid.controller.js'
import { GetAMarketerCampaigns } from '../controllers/get-marketer-campaign.controller.js'

import { getCampaignById } from '../controllers/get-campaign-byid.controller.js'

import { 
  UpdateCampaignTargeting, 
  GetCampaignTargeting 
} from '../controllers/targeting.controller.js';

const router = express.Router();


// GET routes in order of specificity - FIXED ORDER
router.get('/', getCampaignsByStatusAndUserId);
router.get('/user/:userId', GetAMarketerCampaigns);
router.get('/promotions/proof/:promotionId', getProofDetails);

// MOST SPECIFIC DYNAMIC ROUTES LAST - FIXED: This should be BEFORE other dynamic routes
router.get('/:id', getCampaignById);

// POST/PUT routes - MOVED AFTER GET routes to avoid conflicts
router.post('/create', campaignUpload.single('media'), createCampaign);
router.post('/save', campaignUpload.single('media'), saveCampaign);

// General campaign editing routes
router.put('/edit/:campaignId/:performedBy', campaignUpload.single('media'), EditCampaign);
//router.patch('/edit/:campaignId/:performedBy', UpdateCampaignPartial);

// Campaign targeting specific routes
router.put('/targeting/:campaignId/:performedBy', UpdateCampaignTargeting);
router.get('/targeting/:campaignId', GetCampaignTargeting);

router.post('/:campaignId/accept', acceptCampaign);

export default router;