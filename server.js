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
import SettingsRouter from './src/apps/settings/routes/index.route.js';
import ContactRouter from './src/apps/contact/index.js';
import DashboardRouter from './src/apps/dashboard/index.js';
import PromoterRouter from './src/apps/promotion/index.js';
import NotificationRouter from './src/apps/notification/index.js';
import FinancialRouter from './src/apps/financial/routes/index.route.js';
import NewsletterRouter from './src/apps/newsletter/routes/index.js';

// Environment
dotenv.config();
const port = process.env.PORT || 8080;
const app = express();

/* ------------------------------- */
/* 1️⃣ STRICT CORS CONFIG (TOP)     */
/* ------------------------------- */

const allowedOrigins = [
    'http://localhost:4200',
    'http://localhost:4201',
    'http://localhost:4202',
    'https://marketspase.com',
    'https://www.marketspase.com',
    'https://admin.marketspase.com',
];

// CORS middleware must be FIRST
app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }

    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    // Handle OPTIONS preflight immediately
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    next();
});

/* Optionally still use cors() to avoid conflicts */
app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
);

/* ------------------------------------ */
/* 2️⃣ BODY PARSER & COOKIE MIDDLEWARE   */
/* ------------------------------------ */

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

/* Debugging — logs actual origin */
app.use((req, res, next) => {
    console.log('Request Origin:', req.headers.origin);
    next();
});

/* ----------------------- */
/* 3️⃣ ROUTE DECLARATIONS   */
/* ----------------------- */

// Webhook first
app.use('/api/webhook', webhookRoutes);

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

// Static files
app.use('/uploads', express.static(path.join(process.cwd(), 'src', 'uploads')));

/* --------------------- */
/* 4️⃣ DATABASE + SERVER  */
/* --------------------- */

mongoose
    .connect(
        `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@cluster0.fblwb.mongodb.net/${process.env.MONGODB_DATABASE}?retryWrites=true&w=majority&appName=Cluster0`
    )
    .then(() => {
        console.log('Connected to mongoDB');

        // Start cron jobs
        PromotionExpirationCheckerCronJobs();

        app.listen(port, () => {
            console.log(`Server is running on port: http://localhost:${port}`);
        });
    })
    .catch((error) => {
        console.error('Error from mongoDB connection ', error);
    });
