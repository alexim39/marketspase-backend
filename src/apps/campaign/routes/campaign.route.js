import express from 'express';
import { acceptCampaign } from '../controllers/accept-campaign.controller.js'
import { createCampaign } from '../controllers/create-campaign.controller.js'
import { saveCampaign } from '../controllers/save-campaign.controller.js'
import { EditCampaign } from '../controllers/edit-campaign.controller.js'
import { campaignUpload } from '../services/campaign-upload.service.js';
import { getProofDetails, } from '../controllers/get-proof-details.controller.js'
import { getCampaignsByStatusAndUserId } from '../controllers/get-bystatus-and-userid.controller.js'
import { GetAMarketerCampaigns } from '../controllers/get-marketer-campaign.controller.js'
import AdminRouter from './admin/admin.routes.js';
import { getCampaignById } from '../controllers/get-campaign-byid.controller.js'

const CampaignRouter = express.Router();

// Mount AdminRouter under CampaignRouter
CampaignRouter.use('/admin', AdminRouter);

// GET routes in order of specificity - FIXED ORDER
CampaignRouter.get('/', getCampaignsByStatusAndUserId);
CampaignRouter.get('/user/:userId', GetAMarketerCampaigns);
CampaignRouter.get('/promotions/proof/:promotionId', getProofDetails);

// MOST SPECIFIC DYNAMIC ROUTES LAST - FIXED: This should be BEFORE other dynamic routes
CampaignRouter.get('/:id', getCampaignById);

// POST/PUT routes - MOVED AFTER GET routes to avoid conflicts
CampaignRouter.post('/create', campaignUpload.single('media'), createCampaign);
CampaignRouter.post('/save', campaignUpload.single('media'), saveCampaign);
CampaignRouter.put('/edit/:campaignId/:performedBy', campaignUpload.single('media'), EditCampaign);
CampaignRouter.post('/:campaignId/accept', acceptCampaign);

export default CampaignRouter;