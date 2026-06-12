import { FeedPostModel } from '../../models/feed/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/**
 * Admin: Get all feed posts with filtering and pagination
 * GET /api/v1/feed/admin/posts
 */
export const adminGetPosts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    type,
    source,
    search,
    sort = '-createdAt',
    isFeatured,
    authorId
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (type) {
    filter.type = type;
  }

  if (source) {
    filter.source = source;
  }

  if (isFeatured !== undefined && isFeatured !== '') {
    filter.isFeatured = isFeatured === 'true' || isFeatured === true;
  }

  if (authorId) {
    filter.author = authorId;
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { content: searchRegex },
      { 'campaign.name': searchRegex },
      { 'product.name': searchRegex },
      { 'hashtags.tag': searchRegex.toLowerCase() }
    ];
  }

  const [posts, total] = await Promise.all([
    FeedPostModel.find(filter)
      .populate('author', 'username displayName avatar email role isActive isDeleted')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    FeedPostModel.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(total / limitNum);

  return res.status(200).json(
    new ApiResponse(200, {
      posts: posts.map((post) => ({
        _id: post._id,
        author: post.author ? {
          _id: post.author._id,
          username: post.author.username,
          displayName: post.author.displayName,
          avatar: post.author.avatar,
          role: post.author.role
        } : null,
        content: post.content?.substring(0, 200),
        type: post.type,
        source: post.source,
        status: post.status,
        isFeatured: Boolean(post.isFeatured),
        featuredUntil: post.featuredUntil || null,
        featuredBy: post.featuredBy || null,
        campaign: post.campaign ? { name: post.campaign.name } : null,
        product: post.product ? { name: post.product.name } : null,
        likeCount: Array.isArray(post.likes) ? post.likes.length : post.likeCount || 0,
        commentCount: Array.isArray(post.comments) ? post.comments.length : post.commentCount || 0,
        shareCount: Array.isArray(post.shares) ? post.shares.length : post.shareCount || 0,
        mediaCount: Array.isArray(post.media) ? post.media.length : 0,
        primaryMediaType: post.media?.[0]?.type || null,
        hashtags: post.hashtags || [],
        createdAt: post.createdAt,
        updatedAt: post.updatedAt
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: totalPages
      }
    }, 'Feed posts fetched successfully')
  );
});
