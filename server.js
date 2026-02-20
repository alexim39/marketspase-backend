import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
//import axios from "axios";
// Cron Jobs
import { PromotionExpirationCheckerCronJobs } from './src/apps/promotion/services/jobs/promotion-expiration.job.js';
import { CampaignSchedulerService } from './src/apps/campaign/services/jobs/campaign-scheduler.job.js';

import './src/apps/campaign/services/jobs/campaign-notification.job.js'; 
import './src/apps/notification/services/jobs/notification-scheduler.job.js'; 

import AuthRouter from './src/apps/auth/routes/index.route.js';
import UserRouter from './src/apps/user/routes/index.route.js';
import WalletRouter from './src/apps/wallet/routes/index.js';
import CampaignRouter from './src/apps/campaign/routes/index.js';
import SettingsRouter from './src/apps/settings/routes/index.route.js';
import ContactRouter from './src/apps/contact/routes/index.js';
import DashboardRouter from './src/apps/dashboard/routes/index.route.js';
import PromoterRouter from './src/apps/promotion/index.js';
import NotificationRouter from './src/apps/notification/index.js';
import FinancialRouter from './src/apps/financial/routes/index.route.js';
import NewsletterRouter from './src/apps/newsletter/routes/index.js';
import StoreIndexRouter from './src/apps/store/routes/index.route.js';
import ForumIndexRouter from './src/apps/forum/routes/index.js';
import FeedsIndexRouter from './src/apps/feeds/routes/index.route.js';

import handlePaystackWithdrawalWebhook from './src/apps/wallet/services/paystack-webhook-wthdrawal-approval.service.js';
import handlePaystackFundingWebhook from './src/apps/wallet/services/paystack-webhook-deposit-approval.service.js';
import { initWithdrawalSyncCron } from './src/apps/wallet/jobs/withdrawal-sync.cron.js';

// Port and Host
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0'; // Essential for container deployment
const app = express();
dotenv.config();


// This endpoint will be: POST /api/webhook/paystack/approval for withdrawal approval
/* app.post('/api/webhook/paystack', (req, res, next) => {
  // Capture raw body
  let data = '';
  req.setEncoding('utf8');
  req.on('data', chunk => {
    data += chunk;
  });
  req.on('end', () => {
    req.rawBody = data;
    console.log('📦 Raw body captured, length:', data.length);
    
    // Now parse the JSON
    try {
      req.body = JSON.parse(data);
      next();
    } catch (e) {
      console.error('Failed to parse JSON:', e);
      res.status(400).json({ error: 'Invalid JSON' });
    }
  });
}, handlePaystackWithdrawalWebhook); */

// Single webhook endpoint that routes internally
app.post('/api/webhook/paystack', (req, res, next) => {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', chunk => { data += chunk; });
  req.on('end', () => {
    req.rawBody = data;
    
    try {
      req.body = JSON.parse(data);
      
      // // Verify signature
      // const signature = req.headers['x-paystack-signature'];
      // const hash = crypto
      //   .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      //   .update(data)
      //   .digest('hex');

      // if (signature !== hash) {
      //   return res.status(401).send('Unauthorized');
      // }

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

// Debugging middleware to log request origins
// app.get('/my-ip', async (req, res) => {
//     try {
//         // We force the response type to be text to avoid parsing errors
//         const response = await axios.get('https://api.ipify.org');
        
//         // This will now return the actual IP address string
//         res.status(200).send(`Your Outbound IP is: ${response.data}`);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

/* Routes */
app.get('/', (req, res) => res.send('Node server is up and running'));

// app.get('/my-ip', async (req, res) => {
//     const response = await axios.get('https://api.ipify.org');
//     res.json({ outboundIp: response.data.ip });
// });

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

    // Initialize withdrawal sync cron job
    initWithdrawalSyncCron();

    app.listen(PORT, HOST, () => {
        console.log(`Server listening on port ${PORT} at host ${HOST}`);
    });
}).catch((error) => {
    console.error('Error from mongoDB connection ', error);
    process.exit(1);
});