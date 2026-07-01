import mongoose from 'mongoose';
import { PromotionTrackingModel } from '../../models/promotion/index.js';
import { ensureStoreWriteAccess } from '../../services/store-authorization.service.js';

export const getPromoterPerformance = async (req, res) => {
  try {
    const { productId } = req.params;
    const marketerId = req.userId;

    if (!marketerId || !mongoose.Types.ObjectId.isValid(marketerId)) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid product ID is required',
      });
    }

    const results = await PromotionTrackingModel.aggregate([
      {
        $match: {
          product: new mongoose.Types.ObjectId(productId),
          isActive: true,
        },
      },
      {
        $group: {
          _id: '$promoter',
          totalConversions: { $sum: '$conversionCount' },
          totalEarnings: { $sum: '$earnings' },
          totalClicks: { $sum: '$clickCount' },
          totalViews: { $sum: '$viewCount' },
          totalAverageOrderValue: { $sum: '$averageOrderValue' },
          trackingCount: { $sum: 1 },
          clickCounts: { $push: '$clickCount' },
          conversionCounts: { $push: '$conversionCount' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          displayName: { $ifNull: ['$user.displayName', 'Unknown Promoter'] },
          promoterTier: { $ifNull: ['$user.promoterTier', 'unranked'] },
          totalConversions: 1,
          totalEarnings: 1,
          totalClicks: 1,
          totalViews: 1,
          totalAverageOrderValue: 1,
          trackingCount: 1,
          maxClickCount: { $max: '$clickCounts' },
          totalConversionCountSum: { $sum: '$conversionCounts' },
        },
      },
      {
        $addFields: {
          averageOrderValue: {
            $cond: {
              if: { $eq: ['$trackingCount', 0] },
              then: 0,
              else: {
                $divide: ['$totalAverageOrderValue', '$trackingCount'],
              },
            },
          },
          clickToConversionRate: {
            $cond: {
              if: { $eq: ['$totalClicks', 0] },
              then: 0,
              else: {
                $multiply: [
                  { $divide: ['$totalConversions', '$totalClicks'] },
                  100,
                ],
              },
            },
          },
          suspicious: {
            $and: [
              { $gt: ['$maxClickCount', 100] },
              { $eq: ['$totalConversionCountSum', 0] },
            ],
          },
        },
      },
      { $sort: { totalEarnings: -1 } },
    ]);

    const promoters = results.map((row) => ({
      promoterId: row._id,
      displayName: row.displayName,
      promoterTier: row.promoterTier,
      totalConversions: row.totalConversions || 0,
      totalEarnings: Math.round((row.totalEarnings || 0) * 100) / 100,
      averageOrderValue: Math.round((row.averageOrderValue || 0) * 100) / 100,
      clickToConversionRate: Math.round((row.clickToConversionRate || 0) * 10) / 10,
      totalClicks: row.totalClicks || 0,
      totalViews: row.totalViews || 0,
      suspicious: row.suspicious || false,
    }));

    return res.status(200).json({
      success: true,
      count: promoters.length,
      data: promoters,
    });
  } catch (error) {
    console.error('Error fetching promoter performance:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch promoter performance',
    });
  }
};

export const deactivatePromoterForProduct = async (req, res) => {
  try {
    const { productId, promoterId } = req.params;

    if (!req.userId || !mongoose.Types.ObjectId.isValid(req.userId)) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid product ID is required',
      });
    }

    if (!promoterId || !mongoose.Types.ObjectId.isValid(promoterId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid promoter ID is required',
      });
    }

    const productObjectId = new mongoose.Types.ObjectId(productId);
    const promoterObjectId = new mongoose.Types.ObjectId(promoterId);

    const tracking = await PromotionTrackingModel.findOne({
      product: productObjectId,
      promoter: promoterObjectId,
      isActive: true,
    }).populate('store', 'owner');

    if (!tracking) {
      return res.status(404).json({
        success: false,
        message: 'No active promotion tracking found for this product and promoter',
      });
    }

    const storeOwnerId =
      tracking.store?.owner?.toString?.() || tracking.store?.owner?._id?.toString?.();

    if (!storeOwnerId || (storeOwnerId !== req.userId && req.user?.role !== 'admin')) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to manage this promotion',
      });
    }

    tracking.isActive = false;
    tracking.metadata = {
      ...(tracking.metadata || {}),
      deactivatedBy: 'marketer',
      deactivatedAt: new Date().toISOString(),
    };

    await tracking.save();

    return res.status(200).json({
      success: true,
      message: 'Promotion deactivated successfully',
    });
  } catch (error) {
    console.error('Error deactivating promoter:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to deactivate promoter',
    });
  }
};
