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
import { getMarketerLeadAnalytics } from '../controllers/get-marketer-lead-analytics.controller.js';
import { getMarketerLeadDetail } from '../controllers/get-marketer-lead-detail.controller.js';
import { getCampaignPpcPricingConfigController } from '../controllers/ppc-pricing-config.controller.js';
import { setCampaignAutoRenew } from '../../user/controllers/growth-features.controller.js';

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
    const { upi, event, durationMs, sessionId, error: eventError, phone, leadId } = req.body;
    if (!upi || !event) return res.json({ success: false });

    const { PromotionModel } = await import('../../promotion/models/index.js');
    const { CampaignModel } = await import('../models/campaign.model.js');
    const { LandingEventModel } = await import('../models/landing-event.model.js');
    const promotion = await PromotionModel.findOne({ upi }).select('_id campaign promoter').lean();
    if (!promotion) return res.json({ success: false });

    const campaign = await CampaignModel.findById(promotion.campaign).select('owner').lean();

    await LandingEventModel.create({
      campaign: promotion.campaign, promotion: promotion._id, promoter: promotion.promoter,
      marketer: campaign?.owner || undefined,
      upi, event, durationMs, sessionId, error: eventError || undefined,
      phone: phone || undefined, leadId: leadId || undefined,
    });

    if (event === 'lead_success') {
      const { CampaignClickModel } = await import('../models/campaign-click.model.js');
      const { resolvePromoterPpcPayout } = await import('../services/promoter-ppc-payout-policy.service.js');
      const { resolveCampaignCostPerClick } = await import('../services/campaign-pricing.service.js');
      const { UserModel: UM } = await import('../../user/models/user/index.js');

      const pendingClick = await CampaignClickModel.findOne({
        promotion: promotion._id,
        chargeOnLead: true,
        status: 'pending',
      }).sort({ clickedAt: -1 });

      if (pendingClick) {
        const cplCampaign = await CampaignModel.findById(pendingClick.campaign).select('_id title owner budget spentBudget costPerClick payoutPerPromotion currency status');
        const cplMarketer = await UM.findById(pendingClick.marketer);
        const costPerClick = resolveCampaignCostPerClick(
          null,
          cplCampaign?.costPerClick,
          cplCampaign?.payoutPerPromotion
        );
        const payoutResolution = await resolvePromoterPpcPayout({
          promoterId: pendingClick.promoter,
          chargeAmount: costPerClick,
          currency: cplCampaign?.currency || 'NGN',
          now: new Date(),
        });
        const promoterPayoutAmount = payoutResolution.promoterPayoutAmount;
        const platformRetainedAmount = payoutResolution.platformRetainedAmount;
        const payoutPolicy = payoutResolution.payoutPolicy;
        const now = new Date();

        const walletDebit = await UM.updateOne(
          {
            _id: pendingClick.marketer,
            'wallets.marketer.balance': { $gte: costPerClick },
          },
          {
            $inc: { 'wallets.marketer.balance': -costPerClick },
            $push: {
              'wallets.marketer.transactions': {
                $each: [{
                  amount: costPerClick,
                  type: 'debit',
                  category: 'campaign',
                  description: `CPL lead charge for campaign "${cplCampaign?.title || ''}"`,
                  relatedCampaign: pendingClick.campaign,
                  relatedPromotion: pendingClick.promotion,
                  status: 'completed',
                  createdAt: now,
                }],
                $position: 0,
                $slice: 500,
              },
            },
          }
        );

        if (walletDebit.modifiedCount) {
          const getRemainingBudgetExpression = () => ({
            $subtract: ['$budget', { $ifNull: ['$spentBudget', 0] }],
          });

          const campaignChargeResult = await CampaignModel.updateOne(
            {
              _id: pendingClick.campaign,
              status: 'active',
              $expr: {
                $gte: [getRemainingBudgetExpression(), costPerClick],
              },
            },
            {
              $inc: {
                spentBudget: costPerClick,
                billableClicks: 1,
                totalPayouts: promoterPayoutAmount,
              },
              $set: { lastClickAt: now, costPerClick },
            }
          );

          if (campaignChargeResult.modifiedCount) {
            await CampaignClickModel.updateOne(
              { _id: pendingClick._id },
              {
                $set: {
                  status: 'billable',
                  chargeStatus: 'charged',
                  cost: costPerClick,
                  promoterPayoutAmount,
                  platformRetainedAmount,
                  payoutPolicy,
                },
              }
            );

            await UM.updateOne(
              { _id: pendingClick.promoter },
              {
                $inc: { 'wallets.promoter.reserved': promoterPayoutAmount },
                $push: {
                  'wallets.promoter.transactions': {
                    $each: [{
                      amount: promoterPayoutAmount,
                      type: 'credit',
                      category: 'promotion',
                      bucket: 'reserved',
                      description: `CPL earning from campaign "${cplCampaign?.title || ''}" — held for 10hr review`,
                      relatedCampaign: pendingClick.campaign,
                      relatedPromotion: pendingClick.promotion,
                      status: 'reserved',
                      createdAt: now,
                      reservedUntil: new Date(Date.now() + 10 * 60 * 60 * 1000),
                      meta: payoutPolicy
                        ? {
                            originalCostPerClick: costPerClick,
                            platformRetainedAmount,
                            payoutPolicyId: payoutPolicy.policyId,
                          }
                        : undefined,
                    }],
                    $position: 0,
                    $slice: 500,
                  },
                },
              }
            );

            await PromotionModel.updateOne(
              { _id: pendingClick.promotion },
              {
                $inc: {
                  payoutAmount: promoterPayoutAmount,
                  'clickStats.billableClicks': 1,
                  'clickStats.earnedAmount': promoterPayoutAmount,
                },
              }
            );
          }
        }
      }
    }

    // Update promoter tier after new event (fire-and-forget)
    import('../promotion/services/promoter-tier.service.js').then(({ updatePromoterTier }) => {
      updatePromoterTier(promotion.promoter).catch(() => {});
    });

    return res.json({ success: true });
  } catch (e) { return res.json({ success: false }); }
});

// All remaining campaign routes require an authenticated actor.
router.use(authenticate);

// GET routes in order of specificity - FIXED ORDER
router.get('/user/:userId', GetAMarketerCampaigns);
router.get('/analytics/marketer/leads/:campaignId', getMarketerLeadDetail);
router.get('/analytics/marketer/leads', getMarketerLeadAnalytics);
router.get('/analytics/marketer/:userId', getMarketerAnalytics);
router.get('/pricing/config', getCampaignPpcPricingConfigController);
router.get('/', getCampaignsByStatusAndUserId);

// Campaign templates
router.get('/templates', async (req, res) => {
  try {
    const templates = await (await import('../models/campaign-template.model.js')).CampaignTemplateModel
      .find({ owner: req.userId })
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean();
    return res.json({ success: true, data: templates });
  } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
});

router.post('/templates', async (req, res) => {
  try {
    const { name, data } = req.body;
    if (!name || !data) return res.status(400).json({ success: false, message: 'Name and data required.' });
    const template = await (await import('../models/campaign-template.model.js')).CampaignTemplateModel.create({
      owner: req.userId, name, data,
    });
    return res.status(201).json({ success: true, data: template });
  } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/templates/:id', async (req, res) => {
  try {
    await (await import('../models/campaign-template.model.js')).CampaignTemplateModel.findOneAndDelete({
      _id: req.params.id, owner: req.userId,
    });
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
});

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
router.patch('/:campaignId/auto-renew', setCampaignAutoRenew);

export default router;
