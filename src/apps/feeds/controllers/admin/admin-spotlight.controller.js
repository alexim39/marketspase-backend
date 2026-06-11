import { FeedPostModel } from '../../models/feed/index.js';
import { SpotlightConfigModel } from '../../models/spotlight-config.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/**
 * Helper: get or create the singleton spotlight config document.
 * Returns the config with the current active post index resolved.
 */
async function getOrCreateSpotlightConfig() {
  let config = await SpotlightConfigModel.findOne().sort({ createdAt: -1 }).exec();
  if (!config) {
    config = await SpotlightConfigModel.create({
      postIds: [],
      intervalMinutes: 120,
      currentIndex: 0,
      lastRotatedAt: new Date()
    });
  }
  return config;
}

/**
 * Compute the active post index based on elapsed time since last rotation.
 * This ensures rotation is deterministic and consistent across all clients.
 */
function computeActiveIndex(config) {
  const { postIds, intervalMinutes, currentIndex, lastRotatedAt } = config;
  if (!postIds || postIds.length === 0) return -1;

  const elapsedMs = Date.now() - new Date(lastRotatedAt).getTime();
  const intervalMs = intervalMinutes * 60 * 1000;
  const rotationsPassed = Math.floor(elapsedMs / intervalMs);

  if (rotationsPassed <= 0) return currentIndex;

  const newIndex = (currentIndex + rotationsPassed) % postIds.length;

  // Persist the updated index and rotation time so future calculations stay consistent
  SpotlightConfigModel.findByIdAndUpdate(config._id, {
    currentIndex: newIndex,
    lastRotatedAt: new Date(lastRotatedAt.getTime() + rotationsPassed * intervalMs)
  }).catch((err) => {
    console.error('Failed to persist spotlight rotation index:', err.message);
  });

  return newIndex;
}

/**
 * GET /api/v1/feed/admin/spotlight
 * Returns the current spotlight configuration.
 */
export const adminGetSpotlightConfig = asyncHandler(async (req, res) => {
  const config = await getOrCreateSpotlightConfig();
  const activeIndex = computeActiveIndex(config);
  const activePostId = activeIndex >= 0 && config.postIds.length > 0
    ? config.postIds[activeIndex]
    : null;

  // Return full post data for the active post
  let activePost = null;
  if (activePostId) {
    const post = await FeedPostModel.findById(activePostId)
      .populate('author', 'username displayName avatar role isVerified')
      .lean();
    if (post) {
      activePost = {
        _id: post._id,
        author: post.author,
        content: post.content?.substring(0, 300),
        type: post.type,
        source: post.source,
        campaign: post.campaign ? {
          campaignId: post.campaign.campaignId,
          name: post.campaign.name,
          thumbnailUrl: post.campaign.thumbnailUrl
        } : null,
        product: post.product ? {
          productId: post.product.productId,
          name: post.product.name,
          price: post.product.price,
          currency: post.product.currency,
          mainImage: post.product.mainImage,
          storeName: post.product.storeName
        } : null,
        media: post.media || [],
        likeCount: Array.isArray(post.likes) ? post.likes.length : post.likeCount || 0,
        commentCount: Array.isArray(post.comments) ? post.comments.length : post.commentCount || 0,
        shareCount: Array.isArray(post.shares) ? post.shares.length : post.shareCount || 0,
        saveCount: Array.isArray(post.savedBy) ? post.savedBy.length : post.saveCount || 0,
        hashtags: post.hashtags || [],
        createdAt: post.createdAt,
        isFeatured: true,
        chatCount: post.chatCount || 0,
        phone: post.phone
      };
    }
  }

  return res.status(200).json(
    new ApiResponse(200, {
      config: {
        postIds: config.postIds,
        intervalMinutes: config.intervalMinutes,
        currentIndex: activeIndex >= 0 ? activeIndex : config.currentIndex,
        lastRotatedAt: config.lastRotatedAt,
        totalPosts: config.postIds.length
      },
      activePost,
      activePostId
    }, 'Spotlight config fetched successfully')
  );
});

/**
 * PUT /api/v1/feed/admin/spotlight
 * Update spotlight rotation configuration.
 * Body: { postIds: string[], intervalMinutes?: number }
 */
export const adminUpdateSpotlightConfig = asyncHandler(async (req, res) => {
  const { postIds, intervalMinutes } = req.body;
  const adminId = req.userId;

  if (!Array.isArray(postIds) || postIds.length === 0) {
    throw new ApiError(400, 'postIds must be a non-empty array of post IDs');
  }

  if (postIds.length > 50) {
    throw new ApiError(400, 'Maximum of 50 posts allowed in spotlight rotation');
  }

  // Validate that all post IDs exist and are published
  const validPosts = await FeedPostModel.find({
    _id: { $in: postIds },
    status: 'published',
    'moderation.isFlagged': { $ne: true }
  }).select('_id').lean();

  const validIds = new Set(validPosts.map((p) => p._id.toString()));
  const invalidIds = postIds.filter((id) => !validIds.has(id));

  if (invalidIds.length > 0) {
    throw new ApiError(400, `Invalid or non-published post IDs: ${invalidIds.join(', ')}`);
  }

  const interval = intervalMinutes != null
    ? Math.min(43200, Math.max(15, Math.trunc(Number(intervalMinutes) || 120)))
    : 120;

  // Update or create spotlight config
  let config = await SpotlightConfigModel.findOne().sort({ createdAt: -1 }).exec();
  const payload = {
    postIds: postIds.map((id) => id.toString()),
    intervalMinutes: interval,
    currentIndex: 0,
    lastRotatedAt: new Date(),
    updatedBy: adminId
  };

  if (config) {
    // Reset rotation if the post list changed significantly
    const listChanged =
      config.postIds.length !== postIds.length ||
      config.postIds.some((id, i) => id.toString() !== postIds[i]);

    if (listChanged) {
      Object.assign(config, payload);
    } else {
      config.intervalMinutes = interval;
      config.updatedBy = adminId;
      config.updatedAt = new Date();
      // Only reset rotation if interval changed
      if (config.intervalMinutes !== interval) {
        config.lastRotatedAt = new Date();
        config.currentIndex = 0;
      }
    }
    await config.save();
  } else {
    config = await SpotlightConfigModel.create(payload);
  }

  return res.status(200).json(
    new ApiResponse(200, {
      postIds: config.postIds,
      intervalMinutes: config.intervalMinutes,
      currentIndex: config.currentIndex,
      lastRotatedAt: config.lastRotatedAt,
      totalPosts: config.postIds.length
    }, 'Spotlight config updated successfully')
  );
});

/**
 * DELETE /api/v1/feed/admin/spotlight
 * Clear the spotlight rotation entirely.
 */
export const adminClearSpotlight = asyncHandler(async (req, res) => {
  const config = await SpotlightConfigModel.findOne().sort({ createdAt: -1 }).exec();
  if (config) {
    config.postIds = [];
    config.currentIndex = 0;
    config.lastRotatedAt = new Date();
    config.updatedBy = req.userId;
    await config.save();
  }

  return res.status(200).json(
    new ApiResponse(200, null, 'Spotlight rotation cleared')
  );
});
