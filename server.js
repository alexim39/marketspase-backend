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
import EngagementRouter from './src/apps/social/routes/engagement.route.js';
import ForumIndexRouter from './src/apps/forum/routes/index.js';
import FeedsIndexRouter from './src/apps/feeds/routes/index.js';
import ProfileIndexRouter from './src/apps/profile/routes/index.js';
import TutorialIndexRouter from './src/apps/tutorial/routes/index.js';
import { LoginStreakRouter } from './src/apps/streaks/index.js';
import { BadgeRouter } from './src/apps/badges/index.js';
import { currencyMiddleware } from './src/shared/middleware/currency.middleware.js';
import { GamificationRouter } from './src/apps/gamification/index.js';

import { metricsRoutes } from './src/apps/metrics/index.js';
import { aiAssistantRoutes } from './src/apps/ai-assistant/index.js';
import CollaborationRouter from './src/apps/collaboration/index.js';
import SearchRouter from './src/apps/search/index.js';
import CrmRouter from './src/apps/customer-crm/routes/index.js';
import AnalyticsRouter from './src/apps/analytics/routes/analytics.routes.js';
import MarketAiRouter from './src/apps/copilot/routes/marketai.routes.js';
import { ensureGlobalSearchBootstrap } from './src/apps/search/services/search-index.service.js';
import { trackClick as trackStoreAffiliateClick } from './src/apps/store/controllers/promotion/product-tracking.controller.js';
import { serveCampaignLandingPage as campaignLandingPage, createCampaignLead, getCampaignLandingData } from './src/apps/campaign/controllers/campaign-landing.controller.js';
import { serveStoreLandingPage } from './src/apps/store/controllers/promotion/store-landing.controller.js';
import { publicLeadLimiter } from './src/shared/middleware/rate-limit.middleware.js';

// paystack transaction webhook imports
import handlePaystackWithdrawalWebhook from './src/apps/wallet/services/paystack-webhook-wthdrawal-approval.service.js';
import handlePaystackFundingWebhook from './src/apps/wallet/services/paystack-webhook-deposit-approval.service.js';

// cron job imports
import { initWithdrawalSyncCron } from './src/apps/wallet/jobs/withdrawal-sync.cron.js';
import { CampaignSchedulerService } from './src/apps/campaign/services/jobs/campaign-scheduler.job.js';
import { initFileUploadCleanupTask } from './src/utils/cleanup.js';
import { updateVideoViewsJob } from './src/apps/tutorial/jobs/update-video-views.job.js';
import { initServiceEscrowReleaseCron } from './src/apps/store/services/jobs/service-escrow-release.job.js';
import { startExchangeRateCron } from './src/core/exchange-rate.service.js';
import { initCampaignPerformanceCoach } from './src/apps/campaign/services/jobs/campaign-performance-coach.job.js';
import { initPayoutReconciliationCron } from './src/apps/campaign/services/jobs/payout-reconciliation.job.js';
import { initCampaignDigestCron } from './src/apps/campaign/services/jobs/campaign-digest.job.js';
import { initPostEngagementDigestCron } from './src/apps/feeds/services/jobs/post-engagement-digest.job.js';
import { initDailyMissionCron } from './src/apps/social/services/daily-mission.job.js';
import { initAISuggestionsCron } from './src/apps/social/services/ai-suggestions.job.js';
import { initAutoApproveCron } from './src/apps/social/services/auto-approve.job.js';

// FIXED: Import and setup socket handlers
import { setupSocketHandlers } from './src/apps/ai-assistant/socket.handler.js';

// Port and Host
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
const app = express();
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ENABLE_AUTO_INDEX =
    process.env.MONGOOSE_AUTO_INDEX === 'true' ||
    (!IS_PRODUCTION && process.env.MONGOOSE_AUTO_INDEX !== 'false');
const MONGODB_URI = `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@cluster0.fblwb.mongodb.net/${process.env.MONGODB_DATABASE}?retryWrites=true&w=majority&appName=Cluster0`;
const MONGODB_OPTIONS = {
    autoIndex: ENABLE_AUTO_INDEX,
    maxPoolSize: Math.max(Number.parseInt(process.env.MONGODB_MAX_POOL_SIZE || '20', 10) || 20, 5),
    minPoolSize: Math.max(Number.parseInt(process.env.MONGODB_MIN_POOL_SIZE || '2', 10) || 2, 0),
    serverSelectionTimeoutMS: Math.max(Number.parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || '10000', 10) || 10000, 3000),
    socketTimeoutMS: Math.max(Number.parseInt(process.env.MONGODB_SOCKET_TIMEOUT_MS || '45000', 10) || 45000, 10000),
};

mongoose.set('autoIndex', ENABLE_AUTO_INDEX);

const explicitAllowedOrigins = new Set([
    'http://localhost:4200',
    'http://localhost:4201',
    'http://localhost:4202',
    'https://marketspase.com',
    'http://marketspase.com',
    'https://www.marketspase.com',
    'https://admin.marketspase.com',
    'https://apimarketspase1-hyrqzkeb.b4a.run',
]);

const localhostOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;

const isAllowedOrigin = (origin) => {
    if (!origin) {
        return true;
    }

    return explicitAllowedOrigins.has(origin) || localhostOriginPattern.test(origin);
};

const corsOriginDelegate = (origin, callback) => {
    if (isAllowedOrigin(origin)) {
        return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
};

const corsOptions = {
    credentials: true,
    origin: corsOriginDelegate,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

// Create HTTP server for Socket.io
const httpServer = createServer(app);

// FIXED: Setup Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: corsOriginDelegate,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// FIXED: Setup socket handlers and attach io to app
setupSocketHandlers(io);
app.set('io', io);
// Make Socket.IO available to background jobs/services (same process) without threading `app` everywhere.
// This mirrors the existing SSE implementation which stores clients on `global`.
global.realtimeIo = io;

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
app.use(cors(corsOptions));

app.options('*', cors(corsOptions));

/* Routes */
app.get('/', (req, res) => res.send('Node server is up and running'));

// Backward-compatible affiliate tracking URLs (older builds generated links without `/api/v1`).
// Keep these working because promoters may have already shared them.
app.get('/stores/product/promotions/track-click/:uniqueCode', trackStoreAffiliateClick);
app.post('/stores/product/promotions/track-click/:uniqueCode', trackStoreAffiliateClick);

// Public campaign landing page — user-friendly promo URLs
app.get('/c/:upi', campaignLandingPage);
app.get('/api/v1/campaign/landing/:upi', getCampaignLandingData);
app.post('/api/v1/campaign/lead/:upi', publicLeadLimiter, createCampaignLead);

// Public store promotion landing page — friendly /s/:upi URLs for product/service affiliate links
app.get('/s/:upi', serveStoreLandingPage);

app.use(currencyMiddleware);

app.use('/api/v1/auth', AuthRouter);
app.use('/api/v1/user', UserRouter);
app.use('/api/v1/wallet', WalletRouter);
app.use('/api/v1/campaign', CampaignRouter);
app.use('/api/v1/settings', SettingsRouter);
app.use('/api/v1/contact', ContactRouter);
app.use('/api/v1/dashboard', DashboardRouter);
app.use('/api/v1/promotion', PromoterRouter);
app.use('/api/v1/notifications', NotificationRouter);
app.use('/api/v1/financial', FinancialRouter);
app.use('/api/v1/newsletter', NewsletterRouter);
app.use('/api/v1/stores', StoreIndexRouter);
app.use('/api/v1/social', EngagementRouter);
app.use('/api/v1/forum', ForumIndexRouter);
app.use('/api/v1/feed', FeedsIndexRouter);
app.use('/api/v1/profile', ProfileIndexRouter);
app.use('/api/v1/tutorials', TutorialIndexRouter);
app.use('/api/v1/streaks', LoginStreakRouter);
app.use('/api/v1/badges', BadgeRouter);
app.use('/api/v1/gamification', GamificationRouter);
app.use('/api/v1/metrics', metricsRoutes);
app.use('/api/v1/ai-assistant', aiAssistantRoutes);
app.use('/api/v1/collaboration', CollaborationRouter);
app.use('/api/v1/search', SearchRouter);
app.use('/api/v1', CrmRouter);
app.use('/api/v1/analytics', AnalyticsRouter);
app.use('/api/v1/marketai', MarketAiRouter);

// Serve static files
app.use('/uploads', express.static(path.join(process.cwd(), 'src', 'uploads')));

/* DB connection */
mongoose.connect(MONGODB_URI, MONGODB_OPTIONS)
.then(() => {
    console.log(`MongoDB connected (autoIndex=${ENABLE_AUTO_INDEX ? 'on' : 'off'}, maxPoolSize=${MONGODB_OPTIONS.maxPoolSize})`);

    // Start cron jobs
    CampaignSchedulerService.registerCampaignExpiryCron();
    CampaignSchedulerService.registerCampaignExhaustionCron();
    CampaignSchedulerService.registerAutoActivateCampaignsCron();
    initFileUploadCleanupTask();
    updateVideoViewsJob.start();
    initWithdrawalSyncCron();
    initServiceEscrowReleaseCron();
    startExchangeRateCron();
    initCampaignPerformanceCoach();
    initPayoutReconciliationCron();
    initCampaignDigestCron();
    initPostEngagementDigestCron();
    initDailyMissionCron();
    initAISuggestionsCron();
    initAutoApproveCron();
    setImmediate(() => {
        ensureGlobalSearchBootstrap().catch((error) => {
            console.error('[global-search] bootstrap error', error);
        });
    });

    // FIXED: Use httpServer instead of app.listen for Socket.io
    httpServer.listen(PORT, HOST, () => {
        console.log(`Server listening on port ${PORT} at host ${HOST}`);
        console.log(`Socket.io ready for real-time connections`);
    });
}).catch((error) => {
    console.error('Error from mongoDB connection ', error);
    process.exit(1);
});
