import { CampaignModel } from '../../../campaign/models/campaign.model.js';
import { PromotionModel } from "../../../promotion/models/promotion.model.js";




/**
 * @desc    Reject a promotion
 * @route   POST /api/admin/promotions/:id/reject
 * @access  Private/Admin
 */
export const rejectPromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

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
        message: `Promotion cannot be rejected. Current status: ${promotion.status}`
      });
    }

    promotion.status = 'rejected';
    promotion.rejectionReason = reason.trim();
    
    // Add to activity log
    promotion.activityLog.push({
      action: 'Promotion Rejected',
      details: `Promotion rejected by admin. Reason: ${reason}`,
      performedBy: adminId,
      timestamp: new Date()
    });

    await promotion.save();

    // Update campaign stats
    // Guard against counters drifting negative.
    await CampaignModel.updateOne(
      { _id: promotion.campaign._id, currentPromoters: { $gt: 0 } },
      { $inc: { currentPromoters: -1 } }
    );

    // Send notification to promoter
    try {
      await NotificationService.createPromotionRejectedNotification(
        promotion.promoter._id,
        promotion,
        promotion.campaign,
        reason
      );
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
    }

    res.status(200).json({
      success: true,
      data: promotion,
      message: 'Promotion rejected successfully'
    });

  } catch (error) {
    console.error('Reject promotion error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting promotion',
      error: error.message
    });
  }
};
