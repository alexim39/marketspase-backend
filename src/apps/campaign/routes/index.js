import express from 'express';
const app = express();
app.use(express.json()); // Use json middleware
app.use(express.urlencoded({extended: false})); // Use formdata middleware
import indexRouter from './campaign.route.js';
import AdminRouter from './admin/admin.routes.js';
import LeadAnalyticsRouter from './lead-analytics.routes.js';

const CampaignRouter = express.Router();


// Mount CampaignRouter under UserRouter
CampaignRouter.use('/', indexRouter);

// Mount AdminRouter under CampaignRouter
CampaignRouter.use('/admin', AdminRouter);
CampaignRouter.use('/lead', LeadAnalyticsRouter);


export default CampaignRouter;