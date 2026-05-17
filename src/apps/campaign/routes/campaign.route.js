import express from 'express';
import { cloudinaryMediaUpload } from "../../../core/cloudinary.service.js";

import { acceptCampaign } from '../controllers/accept-campaign.controller.js'
import { trackCampaignClick } from '../controllers/track-campaign-click.controller.js'
import { createCampaign } from '../controllers/create-campaign.controller.js'
import { saveCampaign } from '../controllers/save-campaign.controller.js'
import { EditCampaign, UpdateCampaignPartial  } from '../controllers/edit-campaign.controller.js'
import { getCampaignsByStatusAndUserId } from '../controllers/get-by-status-and-userid.controller.js'
import { GetAMarketerCampaigns } from '../controllers/get-marketer-campaign.controller.js'

import { getCampaignById } from '../controllers/get-campaign-byid.controller.js'
import { UpdateCampaignStatus } from '../controllers/update-campaign.controller.js';
import { topUpCampaign } from '../controllers/top-up-campaign.controller.js';

import { UpdateCampaignTargeting, GetCampaignTargeting } from '../controllers/targeting.controller.js';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();


// Public tracking endpoint
router.get('/track/:upi', trackCampaignClick);

// All remaining campaign routes require an authenticated actor.
router.use(authenticate);

// GET routes in order of specificity - FIXED ORDER
router.get('/user/:userId', GetAMarketerCampaigns);
router.get('/', getCampaignsByStatusAndUserId);

// MOST SPECIFIC DYNAMIC ROUTES LAST - FIXED: This should be BEFORE other dynamic routes
router.get('/:id', getCampaignById);

// POST/PUT routes - MOVED AFTER GET routes to avoid conflicts
// router.post('/create', campaignUpload.single('media'), createCampaign);
router.post('/create', cloudinaryMediaUpload.single('media'), createCampaign); 

router.post('/save', cloudinaryMediaUpload.single('media'), saveCampaign);

// General campaign editing routes
router.put('/edit/:campaignId/:performedBy', cloudinaryMediaUpload.single('media'), EditCampaign);
//router.patch('/edit/:campaignId/:performedBy', UpdateCampaignPartial);

// Campaign targeting specific routes
router.put('/targeting/:campaignId/:performedBy', UpdateCampaignTargeting);
router.get('/targeting/:campaignId', GetCampaignTargeting);

router.post('/:campaignId/accept', acceptCampaign);
router.patch('/:id/status', UpdateCampaignStatus);
router.post('/:campaignId/top-up', topUpCampaign);

export default router;
