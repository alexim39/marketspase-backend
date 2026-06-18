import express from 'express';
import { cloudinaryMediaUpload } from "../../../core/cloudinary.service.js";

import { acceptCampaign } from '../controllers/accept-campaign.controller.js'
import { trackCampaignClick } from '../controllers/track-campaign-click.controller.js'
import { serveTrackingRedirectScript } from '../controllers/track-redirect-script.controller.js'
import { createCampaign } from '../controllers/create-campaign.controller.js'
import { saveCampaign } from '../controllers/save-campaign.controller.js'
import { uploadCampaignMedia } from '../controllers/upload-campaign-media.controller.js'
import { EditCampaign, UpdateCampaignPartial  } from '../controllers/edit-campaign.controller.js'
import { getCampaignsByStatusAndUserId } from '../controllers/get-by-status-and-userid.controller.js'
import { GetAMarketerCampaigns } from '../controllers/get-marketer-campaign.controller.js'
import { getMarketerAnalytics } from '../controllers/get-marketer-analytics.controller.js';
import { getCampaignPpcPricingConfigController } from '../controllers/ppc-pricing-config.controller.js';

import { getCampaignById } from '../controllers/get-campaign-byid.controller.js'
import { UpdateCampaignStatus } from '../controllers/update-campaign.controller.js';
import { topUpCampaign } from '../controllers/top-up-campaign.controller.js';

import { UpdateCampaignTargeting, GetCampaignTargeting } from '../controllers/targeting.controller.js';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();


// Public tracking endpoint
router.get('/track-redirect.js', serveTrackingRedirectScript);
router.head('/track/:upi', (_req, res) => res.sendStatus(204));
router.get('/track/:upi', trackCampaignClick);

// Public campaign preview — returns JSON for the landing page Angular component
router.get('/preview/:upi', async (req, res) => {
  try {
    const { PromotionModel } = await import('../../promotion/models/index.js');
    const promotion = await PromotionModel.findOne({ upi: req.params.upi }).populate('campaign').populate('promoter', 'displayName username').lean();
    if (!promotion) return res.json({ success: false });
    if (!promotion.isActive) return res.json({ success: false, suspended: true });
    const c = promotion.campaign;
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.json({
      success: true,
      data: {
        title: c?.title, caption: c?.caption, category: c?.category,
        mediaUrl: c?.mediaUrl, mediaType: c?.mediaType, thumbnailUrl: c?.thumbnailUrl,
        promotionGoal: c?.campaignGoal || c?.promotionGoal || 'awareness',
        promoterName: promotion.promoter?.displayName || null,
        destinationUrl: promotion.destinationUrl || c?.link || null,
      }
    });
  } catch (e) { return res.json({ success: false }); }
});

// Public landing analytics — records user journey events
router.post('/landing/event', async (req, res) => {
  try {
    const { upi, event, durationMs, sessionId, error: eventError } = req.body;
    if (!upi || !event) return res.json({ success: false });

    const { PromotionModel } = await import('../../promotion/models/index.js');
    const { LandingEventModel } = await import('../models/landing-event.model.js');
    const promotion = await PromotionModel.findOne({ upi }).select('_id campaign promoter').lean();
    if (!promotion) return res.json({ success: false });

    await LandingEventModel.create({
      campaign: promotion.campaign, promotion: promotion._id, promoter: promotion.promoter,
      upi, event, durationMs, sessionId, error: eventError || undefined,
    });
    return res.json({ success: true });
  } catch (e) { return res.json({ success: false }); }
});

// All remaining campaign routes require an authenticated actor.
router.use(authenticate);

// GET routes in order of specificity - FIXED ORDER
router.get('/user/:userId', GetAMarketerCampaigns);
router.get('/analytics/marketer/:userId', getMarketerAnalytics);
router.get('/pricing/config', getCampaignPpcPricingConfigController);
router.get('/', getCampaignsByStatusAndUserId);

// MOST SPECIFIC DYNAMIC ROUTES LAST - FIXED: This should be BEFORE other dynamic routes
router.get('/:id', getCampaignById);

// POST/PUT routes - MOVED AFTER GET routes to avoid conflicts
// router.post('/create', campaignUpload.single('media'), createCampaign);
router.post('/create', cloudinaryMediaUpload.single('media'), createCampaign); 

router.post('/save', cloudinaryMediaUpload.single('media'), saveCampaign);
router.post('/media/upload', cloudinaryMediaUpload.single('media'), uploadCampaignMedia);

// General campaign editing routes
router.put('/edit/:campaignId/:performedBy', cloudinaryMediaUpload.single('media'), EditCampaign);
//router.patch('/edit/:campaignId/:performedBy', UpdateCampaignPartial);

// Campaign targeting specific routes
router.put('/targeting/:campaignId/:performedBy', UpdateCampaignTargeting);
router.get('/targeting/:campaignId', GetCampaignTargeting);

router.post('/:campaignId/accept', acceptCampaign);
router.patch('/:id/status', UpdateCampaignStatus);
router.post('/:campaignId/top-up', topUpCampaign);

export default router;
