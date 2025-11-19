import express from 'express';
//import { } from '../controllers/dashboard.controller.js'

const DashboardRouter = express.Router();

// Get random testimonials for specified users
//DashboardRouter.get('/testimonials', getRandomTestimonials);

import BannerMessageRouter from './banner-message.route.js';

// Mount ProfileRouter under UserRouter
DashboardRouter.use('/banner-messages', BannerMessageRouter);

export default DashboardRouter;