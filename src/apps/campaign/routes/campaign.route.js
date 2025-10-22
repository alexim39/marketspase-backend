import express from 'express';
import { acceptCampaign } from '../controllers/accept-campaign.controller.js'
import { createCampaign } from '../controllers/create-campaign.controller.js'
import { saveCampaign } from '../controllers/save-campaign.controller.js'
import { UpdateCampaignStatus } from '../controllers/update-campaign.controller.js'
import { EditCampaign } from '../controllers/edit-campaign.controller.js'
import { getAllCampaigns } from '../controllers/get-all-campaign.controller.js'
import { getCampaignById } from '../controllers/get-campaign-byid.controller.js'
import { campaignUpload } from '../../../services/upload.js';
import { UpdatePromotionStatus } from '../controllers/update-promotion-status.controller.js'
import { getProofDetails, } from '../controllers/get-proof-details.controller.js'
import { getCampaignsByStatusAndUserId } from '../controllers/get-bystatus-and-userid.controller.js'
import { GetAMarketerCampaigns } from '../controllers/get-marketer-campaign.controller.js'



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


/**
 * Get all campaigns for a marketer with pagination
 * @param {string} userId - User ID from URL params
 * @query {number} [page=1] - Page number (optional, default: 1)
 * @query {number} [limit=10] - Items per page (optional, default: 10, max: 100)
 */
// get all campaigns for a marketer
CampaignRouter.get('/user/:userId', GetAMarketerCampaigns);


// admin - get all campaigns
CampaignRouter.get('/campaigns', getAllCampaigns);





/* Dynamic Routes */

// get a campaign by id - used by admin and owner of campaign
CampaignRouter.get('/:id', getCampaignById);



// Admin - update campaign status: approve, reject, pause,
CampaignRouter.patch('/:id/status', UpdateCampaignStatus);
// Admin - update promotion status: approve, reject, pause,
CampaignRouter.patch('/promotion/:id/status/:performedBy', UpdatePromotionStatus);

// GET /api/promotions/proof/:promotionId
CampaignRouter.get('/promotions/proof/:promotionId', getProofDetails);


export default CampaignRouter;