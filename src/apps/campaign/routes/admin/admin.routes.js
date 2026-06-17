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

// Admin - toggle promotion active (suspend/restore link)
AdminRouter.patch('/promotion/:promotionId/toggle-active', async (req, res) => {
  try {
    const { PromotionModel } = await import('../../../promotion/models/index.js');
    const promotion = await PromotionModel.findById(req.params.promotionId);
    if (!promotion) return res.status(404).json({ success: false, message: 'Promotion not found.' });
    promotion.isActive = !promotion.isActive;
    if (!promotion.isActive) {
      promotion.fraudStatus = promotion.fraudStatus || {};
      promotion.fraudStatus.manualHold = true;
      promotion.fraudStatus.manualHoldAt = new Date();
      promotion.fraudStatus.manualHoldBy = req.userId;
      promotion.fraudStatus.manualHoldReason = 'Admin manual suspension';
    } else {
      if (promotion.fraudStatus) promotion.fraudStatus.manualHold = false;
    }
    await promotion.save();
    return res.json({ success: true, isActive: promotion.isActive, message: promotion.isActive ? 'Link restored.' : 'Link suspended.' });
  } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
});

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
