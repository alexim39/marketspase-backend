import express from 'express';
const DashboardRouter = express.Router();
import BannerMessageRouter from './banner-message.route.js';
import StatsRouter from './stats.route.js';

// Mount ProfileRouter
DashboardRouter.use('/banner-messages', BannerMessageRouter);
// Mount StatsRouter
DashboardRouter.use('/stats', StatsRouter);

export default DashboardRouter;