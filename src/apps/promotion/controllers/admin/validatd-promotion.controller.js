import { CampaignModel } from '../../../campaign/models/campaign.model.js';
import { PromotionModel } from "../../../promotion/models/promotion.model.js";




/**
 * @desc    Validate a promotion (approve proof submission)
 * @route   POST /api/admin/promotions/:id/validate
 * @access  Private/Admin
 */
export const validatePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const promotion = await PromotionModel.findById(id)
      .populate('campaign')
      .populate('promoter');

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    if (promotion.status !== 'submitted') {
      return res.status(400).json({
        success: false,
        message: `Promotion cannot be validated. Current status: ${promotion.status}`
      });
    }

    // Check if proof has minimum views
    const campaign = await CampaignModel.findById(promotion.campaign._id);
    const minViewsRequired = campaign?.minViewsPerPromotion || 25;

    if (!promotion.proofViews || promotion.proofViews < minViewsRequired) {
      return res.status(400).json({
        success: false,
        message: `Promotion requires minimum ${minViewsRequired} views. Current views: ${promotion.proofViews || 0}`
      });
    }

    // Set payout amount from campaign
    promotion.payoutAmount = campaign.payoutPerPromotion;
    promotion.status = 'validated';
    promotion.validatedAt = new Date();
    promotion.validatedBy = adminId;

    // Add to activity log
    promotion.activityLog.push({
      action: 'Promotion Validated',
      details: `Promotion validated by admin. Payout: ₦${campaign.payoutPerPromotion}`,
      performedBy: adminId,
      timestamp: new Date()
    });

    await promotion.save();

    // Update campaign stats
    // Use a pipeline update to prevent counters from going negative.
    await CampaignModel.updateOne(
      { _id: promotion.campaign._id },
      [
        {
          $set: {
            validatedPromotions: {
              $add: [{ $ifNull: ["$validatedPromotions", 0] }, 1],
            },
            currentPromoters: {
              $max: [
                { $subtract: [{ $ifNull: ["$currentPromoters", 0] }, 1] },
                0,
              ],
            },
          },
        },
      ]
    );

    // Send notification to promoter
    try {
      await NotificationService.createPromotionValidatedNotification(
        promotion.promoter._id,
        promotion,
        campaign
      );
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
      // Don't fail the main operation if notification fails
    }

    res.status(200).json({
      success: true,
      data: promotion,
      message: 'Promotion validated successfully'
    });

  } catch (error) {
    console.error('Validate promotion error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating promotion',
      error: error.message
    });
  }
};
