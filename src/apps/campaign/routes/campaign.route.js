import express from 'express';
import { acceptCampaign } from '../controllers/accept-campaign.controller.js'
import { createCampaign } from '../controllers/create-campaign.controller.js'
import { saveCampaign } from '../controllers/save-campaign.controller.js'
import { UpdateCampaignStatus } from '../controllers/update-campaign.controller.js'
import { EditCampaign } from '../controllers/edit-campaign.controller.js'
import { getCampaignById, getAUserCampaigns, getAllCampaigns } from '../controllers/get.controller.js'
import { campaignUpload } from '../services/upload.js';
import { getProofDetails, updatePromotionStatus } from '../controllers/promotion.controller.js'
import { getCampaignsByStatusAndUserId } from '../controllers/getByStatusAndUserId.controller.js'




const CampaignRouter = express.Router();

// get campaigns by status (e.g., /campaign?status=active?userId=userId)
CampaignRouter.get('/', getCampaignsByStatusAndUserId);
// create campaign
CampaignRouter.post('/create', campaignUpload.single('media'), createCampaign);
// save campaign to draft
CampaignRouter.post('/save', campaignUpload.single('media'), saveCampaign);
// edit campaign
CampaignRouter.put('/edit/:campaignId/:performedBy', campaignUpload.single('media'), EditCampaign);
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
CampaignRouter.patch('/:id/status', UpdateCampaignStatus);
// Admin - update promotion status: approve, reject, pause,
CampaignRouter.patch('/promotion/:id/status/:performedBy', updatePromotionStatus);

// GET /api/promotions/proof/:promotionId
CampaignRouter.get('/promotions/proof/:promotionId', getProofDetails);


export default CampaignRouter;