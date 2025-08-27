import express from 'express';
import { 
    createCampaign
} from '../controllers/campaign.controller.js'
import { campaignUpload } from '../services/upload.js';

const CampaignRouter = express.Router();

// create compaign payment
CampaignRouter.post('/create', campaignUpload.single('media'), createCampaign);


export default CampaignRouter;