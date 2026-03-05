import { FeedPostModel } from '../models/feed.model.js';
import { FeedNotificationModel } from '../models/feed-notification.model.js';
import { UserModel } from '../../user/models/user.model.js';
import { CampaignModel } from '../../campaign/models/campaign.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Get feed posts (with pagination)
export const getFeedPosts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    type,
    sort = 'trending',
    hashtag,
    author
  } = req.query;

  const userId = req.query.userId;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build query
  const query = { status: 'published' };
  
  if (type) query.type = type;
  if (hashtag) query['hashtags.tag'] = hashtag.toLowerCase();
  if (author) query.author = author;

  // Determine sort order
  let sortOptions = {};
  switch (sort) {
    case 'latest':
      sortOptions = { createdAt: -1 };
      break;
    case 'trending':
      sortOptions = { trendingScore: -1, createdAt: -1 };
      break;
    case 'most_liked':
      sortOptions = { likeCount: -1, createdAt: -1 };
      break;
    case 'most_commented':
      sortOptions = { commentCount: -1, createdAt: -1 };
      break;
    default:
      sortOptions = { createdAt: -1 };
  }

  // Get posts
  const posts = await FeedPostModel.find(query)
    .populate({
      path: 'author',
      select: 'username displayName avatar role rating badge'
    })
    .populate('campaign.campaignId', 'name budget status')
    .populate('earnings.campaignId', 'name')
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  // Get total count
  const totalPosts = await FeedPostModel.countDocuments(query);

  // Add user interaction data
  if (userId) {
    posts.forEach(post => {

      // Add counts
      post.likeCount = post.likes?.length || 0;
      post.commentCount = post.comments?.length || 0;
      post.shareCount = post.shares?.length || 0;

      post.isLiked = post.likes?.some(like => 
        like.user?.toString() === userId.toString()
      ) || false;
      post.isSaved = post.savedBy?.some(saved => 
        saved.user?.toString() === userId.toString()
      ) || false;
      
      // Remove likes/saved arrays from response
      delete post.likes;
      delete post.savedBy;
    });
  }

  // Track impressions
  if (userId) {
    posts.forEach(async (post) => {
      await FeedPostModel.findByIdAndUpdate(post._id, {
        $inc: { 'reach.impressions': 1 },
        $addToSet: { 'reach.uniqueViews': userId }
      });
    });
  }

  return res.status(200).json(
    new ApiResponse(200, {
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalPosts,
        pages: Math.ceil(totalPosts / parseInt(limit))
      }
    }, 'Feed fetched successfully')
  );
});