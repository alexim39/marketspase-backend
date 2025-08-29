import express from 'express';
import { 
    createCampaign, getAllUserCampaigns
} from '../controllers/campaign.controller.js'
import { campaignUpload } from '../services/upload.js';

const CampaignRouter = express.Router();

// create compaign payment
CampaignRouter.post('/create', campaignUpload.single('media'), createCampaign);

// get all campaigns for an advertiser
CampaignRouter.get('/:userId', getAllUserCampaigns);


export default CampaignRouter;