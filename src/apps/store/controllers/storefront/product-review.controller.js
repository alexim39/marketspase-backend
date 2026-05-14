import mongoose from 'mongoose';
import { ReviewModel } from '../../models/review/index.js';
import { ProductModel } from '../../models/promotion/index.js';
import { OrderModel } from '../../models/order/index.js';
import { getAuthenticatedUserId } from '../../../../shared/utils/request-auth.util.js';
import { syncProductReviewStats } from '../../services/review-aggregate.service.js';

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeImages = (images) => {
  if (!images) {
    return [];
  }

  if (Array.isArray(images)) {
    return images
      .map((image) => {
        if (typeof image === 'string') {
          const url = image.trim();
          return url ? { url } : null;
        }

        const url = String(image?.url || '').trim();
        if (!url) {
          return null;
        }

        return {
          url,
          caption: typeof image?.caption === 'string' ? image.caption.trim() : undefined,
        };
      })
      .filter(Boolean);
  }

  if (typeof images === 'string') {
    try {
      return normalizeImages(JSON.parse(images));
    } catch {
      const url = images.trim();
      return url ? [{ url }] : [];
    }
  }

  return [];
};

const detectPlatform = (userAgent = '') => {
  const normalized = String(userAgent || '').toLowerCase();
  if (normalized.includes('iphone') || normalized.includes('ipad') || normalized.includes('ios')) {
    return 'ios';
  }
  if (normalized.includes('android')) {
    return 'android';
  }
  return 'web';
};

const detectDevice = (userAgent = '') => {
  const normalized = String(userAgent || '').toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(normalized)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(normalized)) {
    return 'mobile';
  }
  return 'desktop';
};

const buildReviewResponse = (review) => ({
  _id: review._id,
  rating: review.rating,
  title: review.title || '',
  comment: review.comment,
  images: Array.isArray(review.images) ? review.images.map((image) => image?.url).filter(Boolean) : [],
  verifiedPurchase: Boolean(review.verifiedPurchase),
  helpfulCount: Number(review.helpfulCount || 0),
  reportCount: Number(review.reportCount || 0),
  status: review.status,
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
  timeAgo: review.timeAgo,
  isOwnReview: Boolean(review.isOwnReview),
  isHelpfulByCurrentUser: Boolean(review.isHelpfulByCurrentUser),
  isReportedByCurrentUser: Boolean(review.isReportedByCurrentUser),
  response: review.response || null,
  user: review.userId
    ? {
        _id: review.userId._id,
        displayName: review.userId.displayName || review.userId.username || 'Anonymous',
        avatar: review.userId.avatar || null,
      }
    : null,
});

const findPurchasedOrderForReview = async (userId, productId) => {
  if (!isValidObjectId(userId) || !isValidObjectId(productId)) {
    return null;
  }

  return OrderModel.findOne({
    customer: userId,
    paymentStatus: 'paid',
    isDeleted: { $ne: true },
    'items.product': productId,
  })
    .sort({ paidAt: -1, createdAt: -1 })
    .select('_id items')
    .lean();
};

const prepareReviewContext = async ({ productId, userId }) => {
  if (!isValidObjectId(productId)) {
    return { error: 'Invalid product ID format', status: 400 };
  }

  const product = await ProductModel.findOne({
    _id: productId,
    isDeleted: { $ne: true },
  })
    .select('_id store name')
    .populate('store', '_id settings.autoApproveReviews');

  if (!product) {
    return { error: 'Product not found', status: 404 };
  }

  const purchasedOrder = await findPurchasedOrderForReview(userId, productId);
  const purchasedItem = purchasedOrder?.items?.find((item) => String(item.product) === String(productId)) || null;
  const verifiedPurchase = Boolean(purchasedItem);
  const autoApprove = Boolean(product.store?.settings?.autoApproveReviews);
  const reviewStatus = verifiedPurchase || autoApprove ? 'approved' : 'pending';

  return {
    product,
    purchasedOrder,
    purchasedItem,
    verifiedPurchase,
    reviewStatus,
  };
};

const refreshProductAndStore = async (productId) => {
  const stats = await syncProductReviewStats(productId);
  return stats;
};

export const getCurrentUserProductReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const review = await ReviewModel.findOne({
      productId,
      userId,
      status: { $ne: 'rejected' },
    })
      .populate('userId', 'username displayName avatar');

    if (!review) {
      return res.status(200).json({
        success: true,
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      data: buildReviewResponse(review.toResponse ? review.toResponse(userId) : review),
    });
  } catch (error) {
    console.error('Get current user review error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load your review',
    });
  }
};

export const createProductReview = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { productId } = req.params;
    const { rating, title = '', comment = '', images, variantId, variantName } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const context = await prepareReviewContext({ productId, userId });
    if (context.error) {
      return res.status(context.status).json({
        success: false,
        message: context.error,
      });
    }

    let review = await ReviewModel.findOne({
      productId,
      userId,
      status: { $ne: 'rejected' },
    });

    const payload = {
      rating,
      title,
      comment,
      images: normalizeImages(images),
      storeId: context.product.store?._id || context.product.store,
      verifiedPurchase: context.verifiedPurchase,
      orderId: context.purchasedOrder?._id || undefined,
      variantId: variantId || context.purchasedItem?.variantId || undefined,
      variantName: variantName || context.purchasedItem?.variantName || undefined,
      metadata: {
        device: detectDevice(req.headers['user-agent']),
        platform: detectPlatform(req.headers['user-agent']),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || '',
      },
    };

    if (review) {
      review.rating = payload.rating;
      review.title = payload.title;
      review.comment = payload.comment;
      review.images = payload.images;
      review.verifiedPurchase = payload.verifiedPurchase;
      review.orderId = payload.orderId;
      review.variantId = payload.variantId;
      review.variantName = payload.variantName;
      review.metadata = payload.metadata;
      if (review.status !== 'approved') {
        review.status = context.reviewStatus;
      }
      await review.save();
    } else {
      review = await ReviewModel.create({
        productId,
        userId,
        status: context.reviewStatus,
        ...payload,
      });
    }

    const productStats = await refreshProductAndStore(productId);
    const hydratedReview = await ReviewModel.findById(review._id)
      .populate('userId', 'username displayName avatar');

    return res.status(200).json({
      success: true,
      message: review.status === 'approved'
        ? 'Review saved successfully'
        : 'Review submitted and is pending approval',
      data: buildReviewResponse(hydratedReview.toResponse ? hydratedReview.toResponse(userId) : hydratedReview),
      summary: {
        averageRating: productStats.averageRating,
        totalReviews: productStats.totalReviews,
      },
    });
  } catch (error) {
    console.error('Create product review error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to save review',
    });
  }
};

export const updateProductReview = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { reviewId } = req.params;
    const { rating, title, comment, images } = req.body;

    if (!userId) {
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

    if (String(review.userId) !== String(userId) && req.user?.role !== 'admin' && req.user?.role !== 'super-admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to update this review',
      });
    }

    if (rating !== undefined) review.rating = rating;
    if (title !== undefined) review.title = title;
    if (comment !== undefined) review.comment = comment;
    if (images !== undefined) review.images = normalizeImages(images);
    await review.save();

    const productStats = await refreshProductAndStore(review.productId);
    const hydratedReview = await ReviewModel.findById(review._id)
      .populate('userId', 'username displayName avatar');

    return res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: buildReviewResponse(hydratedReview.toResponse ? hydratedReview.toResponse(userId) : hydratedReview),
      summary: {
        averageRating: productStats.averageRating,
        totalReviews: productStats.totalReviews,
      },
    });
  } catch (error) {
    console.error('Update product review error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update review',
    });
  }
};

export const deleteProductReview = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { reviewId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const review = await ReviewModel.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    if (String(review.userId) !== String(userId) && req.user?.role !== 'admin' && req.user?.role !== 'super-admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to delete this review',
      });
    }

    const { productId } = review;
    await review.deleteOne();

    const productStats = await refreshProductAndStore(productId);

    return res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
      summary: {
        averageRating: productStats.averageRating,
        totalReviews: productStats.totalReviews,
      },
    });
  } catch (error) {
    console.error('Delete product review error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete review',
    });
  }
};

export const toggleReviewHelpful = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { reviewId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const review = await ReviewModel.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    const hasMarkedHelpful = review.helpfulBy.some((id) => String(id) === String(userId));
    if (hasMarkedHelpful) {
      await review.unmarkHelpful(userId);
    } else {
      await review.markHelpful(userId);
    }

    return res.status(200).json({
      success: true,
      message: hasMarkedHelpful ? 'Helpful vote removed' : 'Thanks for the feedback',
      data: {
        helpfulCount: review.helpfulCount,
        isHelpfulByCurrentUser: !hasMarkedHelpful,
      },
    });
  } catch (error) {
    console.error('Toggle review helpful error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update helpful vote',
    });
  }
};

export const reportProductReview = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { reviewId } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!reason || String(reason).trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a reason for this report',
      });
    }

    const review = await ReviewModel.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    await review.report(userId, String(reason).trim());

    return res.status(200).json({
      success: true,
      message: 'Review reported successfully',
    });
  } catch (error) {
    console.error('Report review error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to report review',
    });
  }
};
