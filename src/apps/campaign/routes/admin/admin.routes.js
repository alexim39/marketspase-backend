// routes/promo.routes.js
import express from 'express';
import { getAllCampaigns } from '../../controllers/get-all-campaign.controller.js'
import { UpdateCampaignStatus } from '../../controllers/update-campaign.controller.js'
import { UpdatePromotionStatus } from '../../controllers/update-promotion-status.controller.js'
import {
  getAdminPpcAnalyticsOverviewController,
  getAdminPpcAnalyticsPromotersController,
  getAdminPpcPromoterPromotionLinksController,
  flagPpcPromoterController,
  warnPpcPromoterController,
  suspendPpcPromoterController,
  setPpcPromoterCpcPolicyController,
  clearPpcPromoterCpcPolicyController,
} from '../../controllers/admin/ppc-analytics.controller.js';
import {
  getAdminCampaignPpcPricingConfigController,
  updateAdminCampaignPpcPricingConfigController,
} from '../../controllers/ppc-pricing-config.controller.js';
import { authenticate } from '../../../../shared/middleware/auth.middleware.js';
import { requireAdmin } from '../../../../shared/middleware/authorization.middleware.js';

const AdminRouter = express.Router();

AdminRouter.use(authenticate);
AdminRouter.use(requireAdmin);

// admin - get all campaigns
AdminRouter.get('/campaigns', getAllCampaigns);

// Admin - update campaign status: approve, reject, pause,
AdminRouter.patch('/:id/status', UpdateCampaignStatus);

// Admin - update promotion status: approve, reject, pause,
AdminRouter.patch('/promotion/:id/status/:performedBy', UpdatePromotionStatus);

// Admin - PPC analytics (click + conversion intelligence)
AdminRouter.get('/ppc/overview', getAdminPpcAnalyticsOverviewController);
AdminRouter.get('/ppc/promoters', getAdminPpcAnalyticsPromotersController);
AdminRouter.get('/ppc/promoters/:promoterId/promotion-links', getAdminPpcPromoterPromotionLinksController);
AdminRouter.get('/ppc/pricing-config', getAdminCampaignPpcPricingConfigController);
AdminRouter.put('/ppc/pricing-config', updateAdminCampaignPpcPricingConfigController);

// Admin - PPC promoter actions
AdminRouter.post('/ppc/promoters/:promoterId/flag', flagPpcPromoterController);
AdminRouter.post('/ppc/promoters/:promoterId/warn', warnPpcPromoterController);
AdminRouter.post('/ppc/promoters/:promoterId/suspend', suspendPpcPromoterController);
AdminRouter.post('/ppc/promoters/:promoterId/cpc-policy', setPpcPromoterCpcPolicyController);
AdminRouter.delete('/ppc/promoters/:promoterId/cpc-policy', clearPpcPromoterCpcPolicyController);


export default AdminRouter;
