import express from 'express';
import { 
    createCampaign, 
    getAllUserCampaigns,
    getCampaignsByStatus
} from '../controllers/campaign.controller.js'
import { campaignUpload } from '../services/upload.js';

const CampaignRouter = express.Router();

// create campaign payment
CampaignRouter.post('/create', campaignUpload.single('media'), createCampaign);

// get all campaigns for an advertiser
CampaignRouter.get('/:userId', getAllUserCampaigns);

// get campaigns by status (e.g., /campaign?status=active)
CampaignRouter.get('/', getCampaignsByStatus);

export default CampaignRouter;