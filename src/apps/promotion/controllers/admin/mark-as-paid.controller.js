import { CampaignModel } from '../../../campaign/models/campaign.model.js';
import { PromotionModel } from "../../../promotion/models/promotion.model.js";
import { UserModel } from "../../../user/models/user.model.js";




/**
 * @desc    Mark promotion as paid
 * @route   POST /api/admin/promotions/:id/mark-paid
 * @access  Private/Admin
 */
export const markPromotionAsPaid = async (req, res) => {
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

    if (promotion.status !== 'validated') {
      return res.status(400).json({
        success: false,
        message: `Promotion cannot be marked as paid. Current status: ${promotion.status}`
      });
    }

    if (!promotion.payoutAmount || promotion.payoutAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Promotion has invalid payout amount'
      });
    }

    promotion.status = 'paid';
    promotion.paidAt = new Date();
    promotion.paidBy = adminId;

    // Add to activity log
    promotion.activityLog.push({
      action: 'Promotion Paid',
      details: `Promotion marked as paid. Amount: ₦${promotion.payoutAmount}`,
      performedBy: adminId,
      timestamp: new Date()
    });

    await promotion.save();

    // Update campaign stats
    await CampaignModel.findByIdAndUpdate(
      promotion.campaign._id,
      {
        $inc: {
          paidPromotions: 1,
          spentBudget: promotion.payoutAmount
        }
      }
    );

    // Update promoter wallet
    await UserModel.findByIdAndUpdate(
      promotion.promoter._id,
      {
        $inc: {
          'wallets.promoter.balance': promotion.payoutAmount
        },
        $push: {
          'wallets.promoter.transactions': {
            amount: promotion.payoutAmount,
            type: 'credit',
            category: 'promotion',
            description: `Payment for promotion ${promotion.upi}`,
            relatedPromotion: promotion._id,
            status: 'successful',
            createdAt: new Date()
          }
        }
      }
    );

    // Send notification to promoter
    try {
      await NotificationService.createPaymentProcessedNotification(
        promotion.promoter._id,
        promotion.payoutAmount,
        promotion,
        'promoter'
      );
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
    }

    res.status(200).json({
      success: true,
      data: promotion,
      message: 'Promotion marked as paid successfully'
    });

  } catch (error) {
    console.error('Mark promotion as paid error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking promotion as paid',
      error: error.message
    });
  }
};