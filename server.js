import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';

import './src/apps/campaign/services/jobs/campaign-notification.job.js'; 
import './src/apps/notification/services/jobs/notification-scheduler.job.js'; 

import AuthRouter from './src/apps/auth/routes/index.js';
import UserRouter from './src/apps/user/routes/index.js';
import WalletRouter from './src/apps/wallet/routes/index.js';
import CampaignRouter from './src/apps/campaign/routes/index.js';
import SettingsRouter from './src/apps/settings/routes/index.js';
import ContactRouter from './src/apps/contact/routes/index.js';
import DashboardRouter from './src/apps/dashboard/routes/index.js';
import PromoterRouter from './src/apps/promotion/index.js';
import NotificationRouter from './src/apps/notification/index.js';
import FinancialRouter from './src/apps/financial/routes/index.js';
import NewsletterRouter from './src/apps/newsletter/routes/index.js';
import StoreIndexRouter from './src/apps/store/routes/index.js';
import ForumIndexRouter from './src/apps/forum/routes/index.js';
import FeedsIndexRouter from './src/apps/feeds/routes/index.js';
import ProfileIndexRouter from './src/apps/profile/routes/index.js';
import TutorialIndexRouter from './src/apps/tutorial/routes/index.js';

// paystack transaction webhook imports
import handlePaystackWithdrawalWebhook from './src/apps/wallet/services/paystack-webhook-wthdrawal-approval.service.js';
import handlePaystackFundingWebhook from './src/apps/wallet/services/paystack-webhook-deposit-approval.service.js';

// cron job imports
import { initWithdrawalSyncCron } from './src/apps/wallet/jobs/withdrawal-sync.cron.js';
import { PromotionExpirationCheckerCronJobs } from './src/apps/promotion/services/jobs/promotion-expiration.job.js';
import { CampaignSchedulerService } from './src/apps/campaign/services/jobs/campaign-scheduler.job.js';
import { initFileUploadCleanupTask } from './src/utils/cleanup.js';
import { updateVideoViewsJob } from './src/apps/tutorial/jobs/update-video-views.job.js';

// Port and Host
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0'; // Essential for container deployment
const app = express();
dotenv.config();

// Single webhook endpoint that routes internally
app.post('/api/webhook/paystack', (req, res, next) => {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', chunk => { data += chunk; });
  req.on('end', () => {
    req.rawBody = data;
    
    try {
      req.body = JSON.parse(data);

      // Route based on event type
      const event = req.body.event;
      
      if (event.startsWith('charge.')) {
        // Handle funding events
        return handlePaystackFundingWebhook(req, res);
      } else if (event.startsWith('transfer.')) {
        // Handle withdrawal events
        return handlePaystackWithdrawalWebhook(req, res);
      } else {
        // Acknowledge other events
        return res.status(200).send('OK');
      }
      next();
    } catch (e) {
      console.error('Failed to parse JSON:', e);
      res.status(400).json({ error: 'Invalid JSON' });
    }
  });
});


// Middleware
app.use(express.json({ limit: '50mb' })); // Increase JSON payload limit
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Increase URL-encoded payload limit
app.use(cookieParser());

// CORS Configuration
app.use(cors({
    credentials: true,
    origin: [
        'http://localhost:4200', 
        'http://localhost:4201', 
        'http://localhost:4202', 
        'https://marketspase.com', 
        'http://marketspase.com',
        'https://www.marketspase.com',
        'https://admin.marketspase.com',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Handle preflight requests
app.options('*', cors());

/* Routes */
app.get('/', (req, res) => res.send('Node server is up and running'));
app.use('/auth', AuthRouter);
app.use('/user', UserRouter);
app.use('/wallet', WalletRouter);
app.use('/campaign', CampaignRouter);
app.use('/settings', SettingsRouter);
app.use('/contact', ContactRouter);
app.use('/dashboard', DashboardRouter);
app.use('/promotion', PromoterRouter);
app.use('/notifications', NotificationRouter);
app.use('/financial', FinancialRouter);
app.use('/newsletter', NewsletterRouter);
app.use('/stores', StoreIndexRouter);
app.use('/forum', ForumIndexRouter);
app.use('/feed', FeedsIndexRouter);
app.use('/profile', ProfileIndexRouter);
app.use('/tutorials', TutorialIndexRouter);

// Serve static files
app.use('/uploads', express.static(path.join(process.cwd(), 'src', 'uploads')));

/* DB connection */
mongoose.connect(`mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@cluster0.fblwb.mongodb.net/${process.env.MONGODB_DATABASE}?retryWrites=true&w=majority&appName=Cluster0`)
.then(() => {
    console.log('Connected to mongoDB');

    // Start the cron jobs after a successful database connection
    PromotionExpirationCheckerCronJobs();
    // Call the methods to start the cron jobs
    CampaignSchedulerService.registerCampaignExpiryCron();
    CampaignSchedulerService.registerCampaignExhaustionCron();
    CampaignSchedulerService.registerAutoActivateCampaignsCron();
    initFileUploadCleanupTask()
    updateVideoViewsJob.start();

    // Initialize withdrawal sync cron job
    initWithdrawalSyncCron();

    app.listen(PORT, HOST, () => {
        console.log(`Server listening on port ${PORT} at host ${HOST}`);
    });
}).catch((error) => {
    console.error('Error from mongoDB connection ', error);
    process.exit(1);
});