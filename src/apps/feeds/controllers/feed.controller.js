import { FeedPostModel } from '../models/feed.model.js';
import { FeedCommentModel } from '../models/feed-comment.model.js';
import { FeedNotificationModel } from '../models/feed-notification.model.js';
import { UserModel } from '../../user/models/user.model.js';
import { CampaignModel } from '../../campaign/models/campaign.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Create feed post
export const createFeedPost = asyncHandler(async (req, res) => {
  const { content, type, earnings, campaign, tip, media, badge, userId } = req.body;

  console.log(req.body);

  // Get user details
  const user = await UserModel.findById(userId).select('username displayName avatar role');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Validate campaign if type is campaign
  if (type === 'campaign' && campaign?.campaignId) {
    const campaignData = await CampaignModel.findById(campaign.campaignId);
    if (!campaignData) {
      throw new ApiError(404, 'Campaign not found');
    }
    campaign.name = campaignData.name;
    campaign.budget = campaignData.budget;
  }

  const post = await FeedPostModel.create({
    author: userId,
    content,
    type,
    earnings,
    campaign,
    tip,
    media,
    badge: user.role === 'promoter' ? badge : null,
    hashtags: [],
    mentions: []
  });

  // Populate author details
  await post.populate('author', 'username displayName avatar role rating');

  // Log activity
  await user.logActivity('feed_post_created', `Created a new ${type} post`, {
    resourceType: 'feed',
    resourceId: post._id
  });

  // Create notifications for mentions
  if (post.mentions.length > 0) {
    for (const mention of post.mentions) {
      const mentionedUser = await UserModel.findOne({ username: mention.username });
      if (mentionedUser && mentionedUser._id.toString() !== userId.toString()) {
        await FeedNotificationModel.create({
          recipient: mentionedUser._id,
          type: 'mention',
          post: post._id,
          actor: userId,
          message: `${user.displayName} mentioned you in a post`
        });
      }
    }
  }

  return res.status(201).json(
    new ApiResponse(201, post, 'Post created successfully')
  );
});

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
    .populate('author', 'username displayName avatar role rating badge')
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

// Like/Unlike post
export const togglePostLike = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  const post = await FeedPostModel.findById(postId);
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  const likeIndex = post.likes.findIndex(like => 
    like.user.toString() === userId.toString()
  );

  if (likeIndex === -1) {
    // Like post
    post.likes.push({ user: userId });
    
    // Create notification for post author
    if (post.author.toString() !== userId.toString()) {
      const user = await UserModel.findById(userId).select('displayName');
      await FeedNotificationModel.create({
        recipient: post.author,
        type: 'like',
        post: postId,
        actor: userId,
        message: `${user.displayName} liked your post`
      });
    }
  } else {
    // Unlike post
    post.likes.splice(likeIndex, 1);
  }

  await post.save();

  return res.status(200).json(
    new ApiResponse(200, { 
      liked: likeIndex === -1,
      likeCount: post.likes.length 
    }, likeIndex === -1 ? 'Post liked' : 'Post unliked')
  );
});

// Save/Unsave post
export const toggleSavePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  const post = await FeedPostModel.findById(postId);
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  const savedIndex = post.savedBy.findIndex(saved => 
    saved.user.toString() === userId.toString()
  );

  if (savedIndex === -1) {
    post.savedBy.push({ user: userId, savedAt: new Date() });
  } else {
    post.savedBy.splice(savedIndex, 1);
  }

  await post.save();

  return res.status(200).json(
    new ApiResponse(200, { 
      saved: savedIndex === -1,
      saveCount: post.savedBy.length 
    }, savedIndex === -1 ? 'Post saved' : 'Post unsaved')
  );
});

// Add comment to post
export const addComment = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { content, parentCommentId } = req.body;
  const userId = req.user._id;

  const post = await FeedPostModel.findById(postId);
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  const user = await UserModel.findById(userId).select('username displayName avatar');

  const comment = {
    user: userId,
    content,
    replies: [],
    likes: [],
    createdAt: new Date()
  };

  if (parentCommentId) {
    // Find parent comment
    const parentComment = post.comments.id(parentCommentId);
    if (!parentComment) {
      throw new ApiError(404, 'Parent comment not found');
    }
    parentComment.replies.push(comment);
    
    // Notification for parent comment author
    if (parentComment.user.toString() !== userId.toString()) {
      await FeedNotificationModel.create({
        recipient: parentComment.user,
        type: 'reply',
        post: postId,
        comment: parentCommentId,
        actor: userId,
        message: `${user.displayName} replied to your comment`
      });
    }
  } else {
    post.comments.push(comment);
    
    // Notification for post author
    if (post.author.toString() !== userId.toString()) {
      await FeedNotificationModel.create({
        recipient: post.author,
        type: 'comment',
        post: postId,
        actor: userId,
        message: `${user.displayName} commented on your post`
      });
    }
  }

  await post.save();

  return res.status(201).json(
    new ApiResponse(201, comment, 'Comment added successfully')
  );
});

// Share post
export const sharePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { platform } = req.body;
  const userId = req.user._id;

  const post = await FeedPostModel.findById(postId);
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  post.shares.push({ user: userId, platform, sharedAt: new Date() });
  await post.save();

  return res.status(200).json(
    new ApiResponse(200, { shareCount: post.shares.length }, 'Post shared successfully')
  );
});

// Get single post
export const getPostById = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user?._id;

  const post = await FeedPostModel.findById(postId)
    .populate('author', 'username displayName avatar role rating')
    .populate('campaign.campaignId', 'name budget status')
    .populate('earnings.campaignId', 'name')
    .populate('comments.user', 'username displayName avatar')
    .populate('comments.replies.user', 'username displayName avatar')
    .lean();

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  // Add user interaction data
  if (userId) {
    post.isLiked = post.likes?.some(like => 
      like.user?.toString() === userId.toString()
    ) || false;
    post.isSaved = post.savedBy?.some(saved => 
      saved.user?.toString() === userId.toString()
    ) || false;
    
    // Remove likes/saved arrays
    delete post.likes;
    delete post.savedBy;
  }

  // Track view
  await FeedPostModel.findByIdAndUpdate(postId, {
    $inc: { 'reach.impressions': 1 },
    $addToSet: { 'reach.uniqueViews': userId }
  });

  return res.status(200).json(
    new ApiResponse(200, post, 'Post fetched successfully')
  );
});

// Get trending hashtags
export const getTrendingHashtags = asyncHandler(async (req, res) => {
  const hashtags = await FeedPostModel.aggregate([
    { $unwind: '$hashtags' },
    { $match: { status: 'published' } },
    { $group: {
      _id: '$hashtags.tag',
      count: { $sum: 1 },
      posts: { $push: '$_id' }
    }},
    { $sort: { count: -1 } },
    { $limit: 20 },
    { $project: {
      tag: '$_id',
      count: 1,
      posts: { $slice: ['$posts', 3] }
    }}
  ]);

  return res.status(200).json(
    new ApiResponse(200, hashtags, 'Trending hashtags fetched')
  );
});