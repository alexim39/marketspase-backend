import express from 'express';
import { acceptCampaign } from '../controllers/accept-campaign.controller.js'
import { createCampaign } from '../controllers/create-campaign.controller.js'
import { updateCampaignStatus, updateCampaign } from '../controllers/update-campaign.controller.js'
import { getCampaignById, getAUserCampaigns, getCampaignsByStatus, getAllCampaigns } from '../controllers/get.controller.js'
import { campaignUpload } from '../services/upload.js';
import { getProofDetails,  updatePromotionStatus } from '../controllers/promotion.controller.js'


const CampaignRouter = express.Router();

// get campaigns by status (e.g., /campaign?status=active)
CampaignRouter.get('/', getCampaignsByStatus);
// create campaign
CampaignRouter.post('/create', campaignUpload.single('media'), createCampaign);
// edit campaign
CampaignRouter.put('/edit/:id/:performedBy', campaignUpload.single('media'), updateCampaign);
// promoter accept campaign
CampaignRouter.post('/:campaignId/accept', acceptCampaign);
// get all campaigns for an marketer
CampaignRouter.get('/user/:userId', getAUserCampaigns);





// admin - get all campaigns
CampaignRouter.get('/campaigns', getAllCampaigns);





/* Dynamic Routes */



// get a campaign by id - used by admin and owner of campaign
CampaignRouter.get('/:id', getCampaignById);



// Admin - update campaign status: approve, reject, pause,
CampaignRouter.patch('/:id/status', updateCampaignStatus);
// Admin - update promotion status: approve, reject, pause,
CampaignRouter.patch('/promotion/:id/status/:performedBy', updatePromotionStatus);

// GET /api/promotions/proof/:promotionId
CampaignRouter.get('/promotions/proof/:promotionId', getProofDetails);


export default CampaignRouter;