import { FeedPostModel } from '../models/feed/index.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';


// Get community feed posts with proper pagination
export const getCommunityFeed = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, userId, type, hashtag, search } = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const query = { status: 'published' };
  if (type) query.type = type;
  if (hashtag) query['hashtags.tag'] = hashtag.toLowerCase();
  
  // Add search functionality
  if (search) {
    query.$or = [
      { content: { $regex: search, $options: 'i' } },
      { 'hashtags.tag': { $regex: search, $options: 'i' } }
    ];
  }

  // Get total count for pagination
  const total = await FeedPostModel.countDocuments(query);
  const pages = Math.ceil(total / limitNum);

  const posts = await FeedPostModel.find(query)
    .populate({
      path: 'author',
      select: 'username displayName avatar role rating badge personalInfo'
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

  // Add engagement counts and interaction flags
  posts.forEach(post => {
    post.likeCount = post.likes?.length || 0;
    post.commentCount = post.comments?.length || 0;
    post.shareCount = post.shares?.length || 0;
    post.phone = post.author?.personalInfo?.phone || '';

    if (userId) {
      post.isLiked = post.likes?.some(like => like.user?.toString() === userId.toString()) || false;
      post.isSaved = post.savedBy?.some(saved => saved.user?.toString() === userId.toString()) || false;
    } else {
      post.isLiked = false;
      post.isSaved = false;
    }

    // Clean up
    delete post.likes;
    delete post.savedBy;
    delete post.shares;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const postsToday = await FeedPostModel.countDocuments({
    ...query,
    createdAt: { $gte: today }
  });

  const trendingHashtags = await FeedPostModel.aggregate([
    { $unwind: '$hashtags' },
    { $match: { status: 'published' } },
    { $group: { _id: '$hashtags.tag', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
    { $project: { tag: '$_id', count: 1, _id: 0 } }
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        posts,
        stats: {
          postsToday,
          activeUsers: Math.floor(Math.random() * 50) + 20,
          totalEngagement: posts.reduce(
            (sum, p) => sum + p.likeCount + p.commentCount + (p.shareCount || 0),
            0
          ),
          topHashtag: trendingHashtags[0]?.tag || ''
        },
        trendingHashtags,
        pagination: { 
          page: pageNum, 
          limit: limitNum, 
          total, 
          pages 
        }
      },
      'Community feed fetched successfully'
    )
  );
});