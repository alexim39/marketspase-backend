/* import { PromotionTrackingModel } from '../../models/promotion/index.js';


export const getPromoterPromotions = async (req, res) => {
  try {
    const { promoterId } = req.query;

    const promotions = await PromotionTrackingModel.find({
      promoter: promoterId,
      isActive: true
    })
    .populate('product', 'name price images category')
    .populate('store', 'name logo')
    .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: promotions
    });
  } catch (error) {
    console.error('Error fetching promotions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch promotions'
    });
  }
};
 */