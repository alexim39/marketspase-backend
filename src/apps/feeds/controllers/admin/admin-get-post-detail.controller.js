import { FeedPostModel } from '../../models/feed/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/**
 * Admin: Get detailed view of a single feed post
 * GET /api/v1/feed/admin/posts/:postId
 */
export const adminGetPostDetail = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const post = await FeedPostModel.findById(postId)
    .populate('author', 'username displayName avatar email role phone isActive isDeleted createdAt')
    .populate('featuredBy', 'username displayName')
    .populate('moderation.reviewedBy', 'username displayName')
    .lean();

  if (!post) {
    throw new ApiError(404, 'Feed post not found');
  }

  const author = post.author;
  const likeCount = Array.isArray(post.likes) ? post.likes.length : post.likeCount || 0;
  const commentCount = Array.isArray(post.comments) ? post.comments.length : post.commentCount || 0;
  const shareCount = Array.isArray(post.shares) ? post.shares.length : post.shareCount || 0;
  const saveCount = Array.isArray(post.savedBy) ? post.savedBy.length : post.saveCount || 0;

  return res.status(200).json(
    new ApiResponse(200, {
      _id: post._id,
      author: author ? {
        _id: author._id,
        username: author.username,
        displayName: author.displayName,
        avatar: author.avatar,
        email: author.email,
        role: author.role,
        phone: author.phone,
        isActive: author.isActive,
        isDeleted: author.isDeleted,
        createdAt: author.createdAt
      } : null,
      content: post.content,
      type: post.type,
      source: post.source,
      status: post.status,
      isFeatured: Boolean(post.isFeatured),
      featuredUntil: post.featuredUntil,
      featuredBy: post.featuredBy ? {
        _id: post.featuredBy._id,
        displayName: post.featuredBy.displayName,
        username: post.featuredBy.username
      } : null,
      campaign: post.campaign || null,
      product: post.product || null,
      challenge: post.challenge || null,
      tip: post.tip || null,
      earnings: post.earnings || null,
      media: (post.media || []).map((m) => ({
        url: m.url,
        type: m.type,
        thumbnail: m.thumbnail,
        altText: m.altText,
        order: m.order
      })),
      hashtags: post.hashtags || [],
      mentions: post.mentions || [],
      settings: post.settings || {},
      moderation: post.moderation || {},
      recommendation: post.recommendation || {},
      trendingScore: post.trendingScore || 0,
      likeCount,
      commentCount,
      shareCount,
      saveCount,
      chatCount: post.chatCount || post.socialMetrics?.chatClicks || 0,
      socialMetrics: post.socialMetrics || {},
      reach: post.reach || {},
      createdAt: post.createdAt,
      updatedAt: post.updatedAt
    }, 'Post details fetched successfully')
  );
});
