import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';

// Cron Jobs
import { PromotionExpirationCheckerCronJobs } from './src/apps/promotion/services/jobs/promotion-expiration.job.js';
import './src/apps/campaign/services/jobs/campaign-notification.job.js'; 
import './src/apps/notification/services/jobs/notification-scheduler.job.js'; 

import AuthRouter from './src/apps/auth/routes/index.route.js';
import UserRouter from './src/apps/user/routes/index.route.js';
import WalletRouter from './src/apps/wallet/index.js';
import webhookRoutes from './src/apps/wallet/routes/webhook.routes.js';
import CampaignRouter from './src/apps/campaign/index.js';
import SettingsRouter from './src/apps/settings/index.js';
import ContactRouter from './src/apps/contact/index.js';
import DashboardRouter from './src/apps/dashboard/index.js';
import PromoterRouter from './src/apps/promotion/index.js';
import NotificationRouter from './src/apps/notification/index.js';
import FinancialRouter from './src/apps/financial/routes/index.route.js';

// Port
const port = process.env.PORT || 8080;
const app = express();
dotenv.config();

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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Handle preflight requests
app.options('*', cors());

// Debugging middleware to log request origins
app.use((req, res, next) => {
    console.log('Request Origin:', req.headers.origin);
    next();
});

// Webhook routes (must be before express.json() middleware)
app.use('/api/webhook', webhookRoutes);

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

// Serve static files
app.use('/uploads', express.static(path.join(process.cwd(), 'src', 'uploads')));

/* DB connection */
mongoose.connect(`mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@cluster0.fblwb.mongodb.net/${process.env.MONGODB_DATABASE}?retryWrites=true&w=majority&appName=Cluster0`)
.then(() => {
    console.log('Connected to mongoDB');

    // Start the cron jobs after a successful database connection
    PromotionExpirationCheckerCronJobs();

    app.listen(port, () => {
        console.log(`Server is running on port: http://localhost:${port}`);
    });
}).catch((error) => {
    console.error('Error from mongoDB connection ', error);
});