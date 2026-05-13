import mongoose from 'mongoose';
import { ReviewModel } from '../../models/review/index.js';
import { ProductModel } from '../../models/promotion/index.js';
import { StoreModel } from '../../models/store/index.js';
import { UserModel } from '../../../user/models/user/index.js';
import { syncProductReviewStats } from '../../services/review-aggregate.service.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeSortField = (value) => {
  const allowed = new Set(['createdAt', 'rating', 'helpfulCount', 'reportCount', 'moderatedAt']);
  return allowed.has(value) ? value : 'createdAt';
};

const normalizeSortOrder = (value) => (String(value).toLowerCase() === 'asc' ? 1 : -1);

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const buildReviewProjection = () => ({
  _id: 1,
  title: 1,
  comment: 1,
  rating: 1,
  status: 1,
  helpfulCount: 1,
  reportCount: 1,
  verifiedPurchase: 1,
  isFeatured: 1,
  moderationNotes: 1,
  moderatedAt: 1,
  createdAt: 1,
  updatedAt: 1,
  images: {
    $map: {
      input: { $ifNull: ['$images', []] },
      as: 'image',
      in: '$$image.url',
    },
  },
  response: {
    content: '$response.content',
    createdAt: '$response.createdAt',
    responderName: '$response.responderName',
  },
  metadata: 1,
  user: {
    _id: '$user._id',
    displayName: {
      $ifNull: ['$user.displayName', {
        $ifNull: ['$user.username', 'Anonymous'],
      }],
    },
    username: '$user.username',
    email: '$user.email',
    avatar: '$user.avatar',
  },
  product: {
    _id: '$product._id',
    name: '$product.name',
    price: '$product.price',
    slug: '$product.slug',
    averageRating: '$product.averageRating',
    ratingCount: '$product.ratingCount',
    image: {
      $let: {
        vars: {
          mainImage: {
            $first: {
              $filter: {
                input: { $ifNull: ['$product.images', []] },
                as: 'image',
                cond: { $eq: ['$$image.isMain', true] },
              },
            },
          },
        },
        in: {
          $ifNull: ['$$mainImage.url', {
            $let: {
              vars: {
                firstImage: { $first: { $ifNull: ['$product.images', []] } },
              },
              in: '$$firstImage.url',
            },
          }],
        },
      },
    },
  },
  store: {
    _id: '$store._id',
    name: '$store.name',
    storeLink: '$store.storeLink',
    logo: '$store.logo',
  },
  moderatedBy: {
    _id: '$moderator._id',
    displayName: {
      $ifNull: ['$moderator.displayName', {
        $ifNull: ['$moderator.username', '$moderator.email'],
      }],
    },
    email: '$moderator.email',
  },
  reportReasons: {
    $map: {
      input: { $ifNull: ['$reportedBy', []] },
      as: 'report',
      in: {
        reason: '$$report.reason',
        reportedAt: '$$report.reportedAt',
        reporter: {
          _id: '$$report.user._id',
          displayName: {
            $ifNull: ['$$report.user.displayName', {
              $ifNull: ['$$report.user.username', '$$report.user.email'],
            }],
          },
          email: '$$report.user.email',
        },
      },
    },
  },
});

const buildQueuePipeline = ({
  match,
  search,
  sortField,
  sortOrder,
  skip,
  limit,
}) => {
  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: UserModel.collection.name,
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
      },
    },
    {
      $lookup: {
        from: ProductModel.collection.name,
        localField: 'productId',
        foreignField: '_id',
        as: 'product',
      },
    },
    {
      $lookup: {
        from: StoreModel.collection.name,
        localField: 'storeId',
        foreignField: '_id',
        as: 'store',
      },
    },
    {
      $lookup: {
        from: UserModel.collection.name,
        localField: 'moderatedBy',
        foreignField: '_id',
        as: 'moderator',
      },
    },
    {
      $lookup: {
        from: UserModel.collection.name,
        localField: 'reportedBy.user',
        foreignField: '_id',
        as: 'reporterUsers',
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$store', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$moderator', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        reportedBy: {
          $map: {
            input: { $ifNull: ['$reportedBy', []] },
            as: 'report',
            in: {
              reason: '$$report.reason',
              reportedAt: '$$report.reportedAt',
              user: {
                $first: {
                  $filter: {
                    input: '$reporterUsers',
                    as: 'reporter',
                    cond: { $eq: ['$$reporter._id', '$$report.user'] },
                  },
                },
              },
            },
          },
        },
      },
    },
  ];

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    pipeline.push({
      $match: {
        $or: [
          { title: regex },
          { comment: regex },
          { 'response.content': regex },
          { 'user.displayName': regex },
          { 'user.username': regex },
          { 'user.email': regex },
          { 'product.name': regex },
          { 'store.name': regex },
          { 'store.storeLink': regex },
        ],
      },
    });
  }

  pipeline.push(
    { $sort: { [sortField]: sortOrder, _id: -1 } },
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          { $project: buildReviewProjection() },
        ],
        pagination: [
          { $count: 'total' },
        ],
      },
    },
  );

  return pipeline;
};

const buildSummaryMatch = ({ storeId, rating, reportedOnly, featured }) => {
  const match = {};
  if (storeId && isValidObjectId(storeId)) {
    match.storeId = new mongoose.Types.ObjectId(storeId);
  }
  if (rating) {
    match.rating = Number(rating);
  }
  if (reportedOnly) {
    match.reportCount = { $gt: 0 };
  }
  if (featured === 'true') {
    match.isFeatured = true;
  } else if (featured === 'false') {
    match.isFeatured = false;
  }
  return match;
};

const serializeHydratedReview = (review) => ({
  _id: review._id,
  title: review.title || '',
  comment: review.comment,
  rating: review.rating,
  status: review.status,
  helpfulCount: Number(review.helpfulCount || 0),
  reportCount: Number(review.reportCount || 0),
  verifiedPurchase: Boolean(review.verifiedPurchase),
  isFeatured: Boolean(review.isFeatured),
  moderationNotes: review.moderationNotes || '',
  moderatedAt: review.moderatedAt || null,
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
  images: Array.isArray(review.images) ? review.images.map((image) => image?.url).filter(Boolean) : [],
  response: review.response || null,
  metadata: review.metadata || {},
  user: review.userId ? {
    _id: review.userId._id,
    displayName: review.userId.displayName || review.userId.username || review.userId.email || 'Anonymous',
    username: review.userId.username || '',
    email: review.userId.email || '',
    avatar: review.userId.avatar || null,
  } : null,
  product: review.productId ? {
    _id: review.productId._id,
    name: review.productId.name,
    price: review.productId.price,
    slug: review.productId.slug,
    averageRating: review.productId.averageRating,
    ratingCount: review.productId.ratingCount,
    image: Array.isArray(review.productId.images)
      ? review.productId.images.find((image) => image?.isMain)?.url || review.productId.images[0]?.url || null
      : null,
  } : null,
  store: review.storeId ? {
    _id: review.storeId._id,
    name: review.storeId.name,
    storeLink: review.storeId.storeLink,
    logo: review.storeId.logo || null,
  } : null,
  moderatedBy: review.moderatedBy ? {
    _id: review.moderatedBy._id,
    displayName: review.moderatedBy.displayName || review.moderatedBy.username || review.moderatedBy.email || 'Admin',
    email: review.moderatedBy.email || '',
  } : null,
  reportReasons: Array.isArray(review.reportedBy)
    ? review.reportedBy.map((report) => ({
        reason: report.reason,
        reportedAt: report.reportedAt,
        reporter: report.user ? {
          _id: report.user._id,
          displayName: report.user.displayName || report.user.username || report.user.email || 'User',
          email: report.user.email || '',
        } : null,
      }))
    : [],
});

const hydrateModeratedReview = async (reviewId) => ReviewModel.findById(reviewId)
  .populate('userId', 'displayName username email avatar')
  .populate('productId', 'name price slug averageRating ratingCount images')
  .populate('storeId', 'name storeLink logo')
  .populate('moderatedBy', 'displayName username email')
  .populate('reportedBy.user', 'displayName username email');

export const StoreReviewAdminController = {
  async getReviews(req, res) {
    try {
      const {
        page = DEFAULT_PAGE,
        limit = DEFAULT_LIMIT,
        status = 'pending',
        search = '',
        rating,
        storeId,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        reportedOnly = 'false',
        featured = 'all',
      } = req.query;

      const pageNumber = parsePositiveInt(page, DEFAULT_PAGE);
      const pageSize = Math.min(parsePositiveInt(limit, DEFAULT_LIMIT), MAX_LIMIT);
      const skip = (pageNumber - 1) * pageSize;
      const normalizedSortField = normalizeSortField(sortBy);
      const normalizedSortOrder = normalizeSortOrder(sortOrder);
      const onlyReported = String(reportedOnly) === 'true';

      const match = {};
      if (status && status !== 'all') {
        match.status = status;
      }
      if (rating) {
        match.rating = Number(rating);
      }
      if (storeId) {
        if (!isValidObjectId(storeId)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid store ID format',
          });
        }
        match.storeId = new mongoose.Types.ObjectId(storeId);
      }
      if (onlyReported) {
        match.reportCount = { $gt: 0 };
      }
      if (featured === 'true') {
        match.isFeatured = true;
      } else if (featured === 'false') {
        match.isFeatured = false;
      }

      const [queueResult, summaryResult] = await Promise.all([
        ReviewModel.aggregate(buildQueuePipeline({
          match,
          search: String(search || '').trim(),
          sortField: normalizedSortField,
          sortOrder: normalizedSortOrder,
          skip,
          limit: pageSize,
        })),
        ReviewModel.aggregate([
          { $match: buildSummaryMatch({ storeId, rating, reportedOnly: onlyReported, featured }) },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

      const total = queueResult?.[0]?.pagination?.[0]?.total || 0;
      const summaryMap = summaryResult.reduce((accumulator, item) => {
        accumulator[item._id] = item.count;
        return accumulator;
      }, {});

      const reportedCount = await ReviewModel.countDocuments({
        ...buildSummaryMatch({ storeId, rating, reportedOnly: false, featured }),
        reportCount: { $gt: 0 },
      });

      const featuredCount = await ReviewModel.countDocuments({
        ...buildSummaryMatch({ storeId, rating, reportedOnly: false, featured: 'true' }),
      });

      return res.status(200).json({
        success: true,
        data: queueResult?.[0]?.data || [],
        pagination: {
          page: pageNumber,
          limit: pageSize,
          total,
          pages: Math.ceil(total / pageSize) || 1,
          hasMore: skip + (queueResult?.[0]?.data?.length || 0) < total,
        },
        summary: {
          totalReviews: Object.values(summaryMap).reduce((sum, count) => sum + count, 0),
          pending: summaryMap.pending || 0,
          approved: summaryMap.approved || 0,
          rejected: summaryMap.rejected || 0,
          flagged: summaryMap.flagged || 0,
          reported: reportedCount,
          featured: featuredCount,
        },
      });
    } catch (error) {
      console.error('Admin get reviews error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to load review moderation queue',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  },

  async moderateReview(req, res) {
    try {
      const { reviewId } = req.params;
      const { action, note = '', featured, response } = req.body;
      const adminId = req.userId;

      if (!adminId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      if (!isValidObjectId(reviewId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid review ID format',
        });
      }

      const review = await ReviewModel.findById(reviewId);
      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found',
        });
      }

      switch (action) {
        case 'approve':
          await review.approve(adminId, String(note || '').trim());
          break;
        case 'reject':
          await review.reject(adminId, String(note || '').trim());
          break;
        case 'clear_flags':
          await review.clearFlags(adminId);
          if (String(note || '').trim()) {
            review.moderationNotes = String(note).trim();
            await review.save();
          }
          break;
        case 'feature':
          review.isFeatured = typeof featured === 'boolean' ? featured : !review.isFeatured;
          review.moderatedBy = adminId;
          review.moderatedAt = new Date();
          if (String(note || '').trim()) {
            review.moderationNotes = String(note).trim();
          }
          await review.save();
          break;
        case 'respond': {
          const responseText = String(response || '').trim();
          if (!responseText) {
            return res.status(400).json({
              success: false,
              message: 'Response content is required',
            });
          }

          const admin = await UserModel.findById(adminId).select('displayName username email');
          const responderName = admin?.displayName || admin?.username || admin?.email || 'MarketSpase Admin';
          if (review.response?.content) {
            await review.updateResponse(responseText);
            review.response.responderName = responderName;
            review.response.respondedBy = adminId;
            await review.save();
          } else {
            await review.addResponse(responseText, adminId, responderName);
          }
          break;
        }
        case 'delete':
          await review.deleteOne();
          await syncProductReviewStats(review.productId);
          return res.status(200).json({
            success: true,
            message: 'Review removed successfully',
          });
        default:
          return res.status(400).json({
            success: false,
            message: 'Unsupported moderation action',
          });
      }

      await syncProductReviewStats(review.productId);
      const hydrated = await hydrateModeratedReview(reviewId);

      return res.status(200).json({
        success: true,
        message: 'Review moderation updated successfully',
        data: hydrated ? serializeHydratedReview(hydrated) : null,
      });
    } catch (error) {
      console.error('Admin moderate review error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update review moderation',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  },
};
