
import { CampaignModel } from '../../../campaign/models/campaign.model.js';
import { PromotionModel } from "../../../promotion/models/promotion.model.js";



/**
 * @desc    Revert promotion to submitted status
 * @route   POST /api/admin/promotions/:id/revert
 * @access  Private/Admin
 */
export const revertPromotionToSubmitted = async (req, res) => {
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

    if (!['validated', 'rejected'].includes(promotion.status)) {
      return res.status(400).json({
        success: false,
        message: `Promotion cannot be reverted from status: ${promotion.status}`
      });
    }

    const oldStatus = promotion.status;
    promotion.status = 'submitted';
    promotion.rejectionReason = undefined;

    // Add to activity log
    promotion.activityLog.push({
      action: 'Status Reverted',
      details: `Promotion reverted from ${oldStatus} to submitted`,
      performedBy: adminId,
      timestamp: new Date()
    });

    await promotion.save();

    // Update campaign stats
    const updateFields = {};
    if (oldStatus === 'validated') {
      updateFields.$inc = {
        validatedPromotions: -1,
        currentPromoters: 1
      };
    } else if (oldStatus === 'rejected') {
      updateFields.$inc = { currentPromoters: 1 };
    }

    if (Object.keys(updateFields).length > 0) {
      await CampaignModel.findByIdAndUpdate(
        promotion.campaign._id,
        updateFields
      );
    }

    res.status(200).json({
      success: true,
      data: promotion,
      message: 'Promotion reverted to submitted status successfully'
    });

  } catch (error) {
    console.error('Revert promotion error:', error);
    res.status(500).json({
      success: false,
      message: 'Error reverting promotion',
      error: error.message
    });
  }
};