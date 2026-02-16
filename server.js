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

import { registerPaymentEngine } from "./src/apps/payments/index.js";

//import { buildPaymentRouter } from "./src/apps/payments/router.js";

// Port and Host
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0'; // Essential for container deployment
const app = express();
dotenv.config();

// Mount webhooks BEFORE body parsers
registerPaymentEngine(app, {
  // enableCron: true, // default
});

//app.use('/api/webhook/paystack', buildPaymentRouter());


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

    app.listen(PORT, HOST, () => {
        console.log(`Server listening on port ${PORT} at host ${HOST}`);
    });
}).catch((error) => {
    console.error('Error from mongoDB connection ', error);
    process.exit(1);
});