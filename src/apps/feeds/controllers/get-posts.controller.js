import { FeedPostModel } from '../models/feed/index.js';
import { getAuthorPopulation, shapeFeedPost, trackFeedImpressions } from '../services/feed-discovery.service.js';
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

  const userId = req.userId || null;
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
    .populate(getAuthorPopulation())
    .populate('campaign.campaignId', 'title budget status link mediaUrl mediaType thumbnailUrl category')
    .populate('product.productId', 'name price originalPrice currency category images')
    .populate('product.storeId', 'name storeLink')
    .populate('earnings.campaignId', 'title')
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  // Get total count
  const totalPosts = await FeedPostModel.countDocuments(query);

  const shapedPosts = posts.map((post) => shapeFeedPost(post, userId));
  await trackFeedImpressions(shapedPosts, userId).catch(() => null);

  return res.status(200).json(
    new ApiResponse(200, {
      posts: shapedPosts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalPosts,
        pages: Math.ceil(totalPosts / parseInt(limit))
      }
    }, 'Feed fetched successfully')
  );
});
