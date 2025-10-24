import { PromotionModel } from "../../../promotion/models/promotion.model.js";


/**
 * @desc    Get promotion activity log
 * @route   GET /api/admin/promotions/:id/activity
 * @access  Private/Admin
 */
export const getPromotionActivityLog = async (req, res) => {
  try {
    const { id } = req.params;

    const promotion = await PromotionModel.findById(id)
      .select('activityLog upi')
      .populate('activityLog.performedBy', 'displayName email');

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        upi: promotion.upi,
        activityLog: promotion.activityLog
      },
      message: 'Activity log retrieved successfully'
    });

  } catch (error) {
    console.error('Get promotion activity log error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving activity log',
      error: error.message
    });
  }
};