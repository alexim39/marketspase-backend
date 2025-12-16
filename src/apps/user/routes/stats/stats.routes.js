/* // routes/promo.routes.js
import express from 'express';
import { getRevenueStats, getEngagementStats } from '../../controllers/admin/admin-dashobard-stats.controller.js'

const StatsRouter = express.Router();

StatsRouter.get('/revenue', getRevenueStats);

StatsRouter.get('/engagement', getEngagementStats);

export default StatsRouter; */