import express from 'express';
import { 
    createCampaign
} from '../controllers/campaign.controller.js'

const CampaignRouter = express.Router();

// create compaign payment
CampaignRouter.post('/create', createCampaign);


export default CampaignRouter;