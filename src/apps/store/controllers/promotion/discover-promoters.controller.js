import mongoose from 'mongoose';
import { PromotionTrackingModel, ProductModel } from '../../models/promotion/index.js';
import { StoreModel } from '../../models/store/index.js';
import { UserModel } from '../../../user/models/user/index.js';
import { NotificationService } from '../../../notification/services/notification.service.js';
import { ensureStoreWriteAccess } from '../../services/store-authorization.service.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const VALID_SORT_FIELDS = {
  conversionRate: 'conversionRate',
  earnings: 'totalEarningsGenerated',
  conversions: 'totalConversions',
  tier: 'promoterTier',
};

const TIER_ORDER = { unranked: 0, bronze: 1, silver: 2, gold: 3 };

function getMostFrequentCategory(categories) {
  if (!categories || !categories.length) return null;
  const freq = {};
  for (const cat of categories) {
    if (cat) {
      freq[cat] = (freq[cat] || 0) + 1;
    }
  }
  let top = null;
  let maxCount = 0;
  for (const [cat, count] of Object.entries(freq)) {
    if (count > maxCount) {
      maxCount = count;
      top = cat;
    }
  }
  return top;
}

export const discoverPromoters = async (req, res) => {
  try {
    const marketerId = req.userId;
    if (!marketerId || !mongoose.Types.ObjectId.isValid(marketerId)) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const {
      category,
      sortBy = 'conversionRate',
      sortDir = 'desc',
      limit: limitParam,
    } = req.query;

    const limit = Math.min(
      Math.max(parseInt(limitParam, 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const sortField = VALID_SORT_FIELDS[sortBy] || VALID_SORT_FIELDS.conversionRate;
    const sortDirection = sortDir === 'asc' ? 1 : -1;

    const pipeline = [
      { $match: { isActive: true, isApproved: true } },
      {
        $lookup: {
          from: 'products',
          let: { productId: '$product' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$productId'] },
                isActive: true,
                isDeleted: false,
              },
            },
            { $project: { _id: 1, category: 1 } },
          ],
          as: 'productDoc',
        },
      },
      { $unwind: { path: '$productDoc', preserveNullAndEmptyArrays: true } },
    ];

    if (category) {
      pipeline.push({ $match: { 'productDoc.category': category } });
    }

    pipeline.push(
      {
        $group: {
          _id: '$promoter',
          totalConversions: { $sum: '$conversionCount' },
          totalEarningsGenerated: { $sum: '$earnings' },
          totalClicks: { $sum: '$clickCount' },
          categories: { $push: '$productDoc.category' },
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
          totalConversions: 1,
          totalEarningsGenerated: 1,
          totalClicks: 1,
          averageConversionRate: {
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
          displayName: '$user.displayName',
          promoterTier: '$user.promoterTier',
          categories: 1,
        },
      },
    );

    if (sortField === 'promoterTier') {
      pipeline.push({ $sort: { totalEarningsGenerated: sortDirection } });
    } else {
      pipeline.push({ $sort: { [sortField]: sortDirection } });
    }

    pipeline.push({ $limit: limit });

    const results = await PromotionTrackingModel.aggregate(pipeline);

    const promoters = results.map((row) => ({
      promoterId: row._id,
      displayName: row.displayName || 'Unknown Promoter',
      promoterTier: row.promoterTier || 'unranked',
      totalConversions: row.totalConversions || 0,
      totalEarningsGenerated: Math.round((row.totalEarningsGenerated || 0) * 100) / 100,
      averageConversionRate: Math.round((row.averageConversionRate || 0) * 10) / 10,
      topCategory: getMostFrequentCategory(row.categories),
    }));

    if (sortField === 'promoterTier') {
      promoters.sort((a, b) => {
        const aOrder = TIER_ORDER[a.promoterTier] || 0;
        const bOrder = TIER_ORDER[b.promoterTier] || 0;
        return sortDirection === 1 ? aOrder - bOrder : bOrder - aOrder;
      });
    }

    return res.status(200).json({
      success: true,
      count: promoters.length,
      data: promoters,
    });
  } catch (error) {
    console.error('Error discovering promoters:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to discover promoters',
    });
  }
};

export const invitePromoterToPromote = async (req, res) => {
  try {
    const marketerId = req.userId;
    if (!marketerId || !mongoose.Types.ObjectId.isValid(marketerId)) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { promoterId } = req.params;
    const { productId, message } = req.body;

    if (!promoterId || !mongoose.Types.ObjectId.isValid(promoterId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid promoter ID is required',
      });
    }

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid product ID is required',
      });
    }

    const [promoter, product, store] = await Promise.all([
      UserModel.findById(promoterId).select('_id displayName role isActive'),
      ProductModel.findById(productId).select('_id name store isActive isDeleted'),
      StoreModel.findOne({ owner: mongoose.Types.ObjectId(marketerId) }).select('_id'),
    ]);

    if (!promoter || promoter.isActive === false) {
      return res.status(404).json({
        success: false,
        message: 'Promoter not found or inactive',
      });
    }

    if (promoter.role !== 'promoter') {
      return res.status(400).json({
        success: false,
        message: 'User is not a promoter',
      });
    }

    if (!product || product.isActive === false || product.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or not available',
      });
    }

    if (!store) {
      return res.status(403).json({
        success: false,
        message: 'You do not own a store',
      });
    }

    if (product.store.toString() !== store._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'This product does not belong to your store',
      });
    }

    const defaultMessage = `You've been invited to promote "${product.name}". Click to view and start promoting.`;
    const notificationMessage = message || defaultMessage;

    await NotificationService.createNotification({
      recipient: promoterId,
      type: 'promotion_assigned',
      title: 'New Promotion Invitation',
      message: notificationMessage,
      data: {
        productId: product._id.toString(),
        productName: product.name,
        actionUrl: `/promote/${product._id}`,
        invitedBy: marketerId,
      },
      priority: 'high',
    });

    return res.status(200).json({
      success: true,
      message: 'Invitation sent successfully',
    });
  } catch (error) {
    console.error('Error inviting promoter:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send invitation',
    });
  }
};
