import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';

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
import { LoginStreakRouter } from './src/apps/streaks/index.js';
import { BadgeRouter } from './src/apps/badges/index.js';
import { GamificationRouter } from './src/apps/gamification/index.js';

import { metricsRoutes } from './src/apps/metrics/index.js';
import { aiAssistantRoutes } from './src/apps/ai-assistant/index.js';

// paystack transaction webhook imports
import handlePaystackWithdrawalWebhook from './src/apps/wallet/services/paystack-webhook-wthdrawal-approval.service.js';
import handlePaystackFundingWebhook from './src/apps/wallet/services/paystack-webhook-deposit-approval.service.js';

// cron job imports
import { initWithdrawalSyncCron } from './src/apps/wallet/jobs/withdrawal-sync.cron.js';
import { PromotionExpirationCheckerCronJobs } from './src/apps/promotion/services/jobs/promotion-expiration.job.js';
import { CampaignSchedulerService } from './src/apps/campaign/services/jobs/campaign-scheduler.job.js';
import { initFileUploadCleanupTask } from './src/utils/cleanup.js';
import { updateVideoViewsJob } from './src/apps/tutorial/jobs/update-video-views.job.js';

// FIXED: Import and setup socket handlers
import { setupSocketHandlers } from './src/apps/ai-assistant/socket.handler.js';

// Port and Host
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
const app = express();

// Create HTTP server for Socket.io
const httpServer = createServer(app);

// FIXED: Setup Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:4200', 
      'http://localhost:4201', 
      'http://localhost:4202', 
      'https://marketspase.com', 
      'http://marketspase.com',
      'https://www.marketspase.com',
      'https://admin.marketspase.com',
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// FIXED: Setup socket handlers and attach io to app
setupSocketHandlers(io);
app.set('io', io);

// Single webhook endpoint that routes internally
app.post('/api/webhook/paystack', (req, res, next) => {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', chunk => { data += chunk; });
  req.on('end', () => {
    req.rawBody = data;
    
    try {
      req.body = JSON.parse(data);
      const event = req.body.event;
      
      if (event.startsWith('charge.')) {
        return handlePaystackFundingWebhook(req, res);
      } else if (event.startsWith('transfer.')) {
        return handlePaystackWithdrawalWebhook(req, res);
      } else {
        return res.status(200).send('OK');
      }
    } catch (e) {
      console.error('Failed to parse JSON:', e);
      res.status(400).json({ error: 'Invalid JSON' });
    }
  });
});

// Middleware
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
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

app.options('*', cors());

/* Routes */
app.get('/', (req, res) => res.send('Node server is up and running'));
app.use('/auth', AuthRouter);
app.use('/api/v1/auth', AuthRouter);
app.use('/user', UserRouter);
app.use('/api/v1/user', UserRouter);
app.use('/wallet', WalletRouter);
app.use('/campaign', CampaignRouter);
app.use('/settings', SettingsRouter);
app.use('/contact', ContactRouter);
app.use('/dashboard', DashboardRouter);
app.use('/promotion', PromoterRouter);
app.use('/notifications', NotificationRouter);
app.use('/financial', FinancialRouter);
app.use('/api/v1/financial', FinancialRouter);
app.use('/newsletter', NewsletterRouter);
app.use('/stores', StoreIndexRouter);
app.use('/forum', ForumIndexRouter);
app.use('/feed', FeedsIndexRouter);
app.use('/profile', ProfileIndexRouter);
app.use('/tutorials', TutorialIndexRouter);
app.use('/api/v1/streaks', LoginStreakRouter);
app.use('/api/v1/badges', BadgeRouter);
app.use('/api/v1/gamification', GamificationRouter);
app.use('/api/v1/metrics', metricsRoutes);
app.use('/api/v1/ai-assistant', aiAssistantRoutes);

// Serve static files
app.use('/uploads', express.static(path.join(process.cwd(), 'src', 'uploads')));

/* DB connection */
mongoose.connect(`mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@cluster0.fblwb.mongodb.net/${process.env.MONGODB_DATABASE}?retryWrites=true&w=majority&appName=Cluster0`)
.then(() => {

    // Start cron jobs
    PromotionExpirationCheckerCronJobs();
    CampaignSchedulerService.registerCampaignExpiryCron();
    CampaignSchedulerService.registerCampaignExhaustionCron();
    CampaignSchedulerService.registerAutoActivateCampaignsCron();
    initFileUploadCleanupTask();
    updateVideoViewsJob.start();
    initWithdrawalSyncCron();

    // FIXED: Use httpServer instead of app.listen for Socket.io
    httpServer.listen(PORT, HOST, () => {
        console.log(`Server listening on port ${PORT} at host ${HOST}`);
        console.log(`Socket.io ready for real-time connections`);
    });
}).catch((error) => {
    console.error('Error from mongoDB connection ', error);
    process.exit(1);
});
