import { FeedPostModel } from '../models/feed.model.js';
import { FeedNotificationModel } from '../models/feed-notification.model.js';
import { UserModel } from '../../user/models/user.model.js';
import { CampaignModel } from '../../campaign/models/campaign.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Create feed post
// Create campaign update post (for marketers)
export const createFeedPost = asyncHandler(async (req, res) => {
  const { content, campaignId, hashtags, userId, settings } = req.body;

  // Get user details
  const user = await UserModel.findById(userId).select('username displayName avatar role');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Verify user is a marketer
  if (user.role !== 'marketer') {
    throw new ApiError(403, 'Only marketers can create campaign updates');
  }

  // Get campaign details
  const campaign = await CampaignModel.findById(campaignId);
  if (!campaign) {
    throw new ApiError(404, 'Campaign not found');
  }

  // Verify campaign belongs to user
  if (campaign.owner.toString() !== userId) {
    throw new ApiError(403, 'You can only create updates for your own campaigns');
  }

  // Create post with campaign data
  const post = await FeedPostModel.create({
    author: userId,
    content,
    type: 'campaign',
    campaign: {
      campaignId: campaign._id,
      name: campaign.title,
      budget: campaign.budget,
      spentBudget: campaign.spentBudget,
      status: campaign.status,
      progress: campaign.progress
    },
    media: [{
      url: campaign.mediaUrl,
      type: campaign.mediaType,
      thumbnail: campaign.thumbnailUrl
    }],
    hashtags: hashtags || [],
    settings: {
      postAnonymously: settings?.postAnonymously || false,
      disableComments: settings?.disableComments || false
    }
  });

  // Populate author details (handle anonymous)
  if (settings?.postAnonymously) {
    post.author = null;
  } else {
    await post.populate('author', 'username displayName avatar role rating');
  }

  // Log activity
  await user.logActivity('campaign_update', `Created an update for campaign: ${campaign.title}`, {
    resourceType: 'feed',
    resourceId: post._id,
    metadata: { campaignId: campaign._id }
  });

  return res.status(201).json(
    new ApiResponse(201, post, 'Campaign feed created successfully')
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

// Like/Unlike post
export const togglePostLike = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { userId } = req.body;

  // console.log('like postId ', postId)
  // console.log('lik body ', userId)

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
    if (post?.author?.toString() !== userId?.toString()) {
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
  const { userId } = req.body;

  // console.log('save postId ', postId)
  // console.log('save body ', userId)

  const post = await FeedPostModel.findById(postId);
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  const savedIndex = post.savedBy.findIndex(saved => 
    saved.user?.toString() === userId?.toString()
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


export const addComment = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { content, parentCommentId, userId } = req.body;

  const post = await FeedPostModel.findById(postId);
  if (!post) throw new ApiError(404, 'Post not found');

  const user = await UserModel.findById(userId).select('username displayName avatar');

  const comment = {
    user: userId,
    content,
    replies: [],
    likes: [],
    createdAt: new Date()
  };

  if (parentCommentId) {
    const parentComment = post.comments.id(parentCommentId);
    if (!parentComment) throw new ApiError(404, 'Parent comment not found');
    parentComment.replies.push(comment);
    await post.save();

    // Get the newly added reply
    const newReply = parentComment.replies[parentComment.replies.length - 1];
    await FeedPostModel.populate(newReply, { path: 'user', select: 'displayName username avatar' });

    // Add computed fields
    const replyObj = newReply.toObject();
    replyObj.likeCount = replyObj.likes?.length || 0;
    replyObj.isLiked = replyObj.likes?.some(like => like.toString() === userId.toString()) || false;
    delete replyObj.likes;

    return res.status(201).json(new ApiResponse(201, replyObj, 'Reply added'));
  } else {
    post.comments.push(comment);
    await post.save();

    const newComment = post.comments[post.comments.length - 1];
    await FeedPostModel.populate(newComment, { path: 'user', select: 'displayName username avatar' });

    const commentObj = newComment.toObject();
    commentObj.likeCount = commentObj.likes?.length || 0;
    commentObj.isLiked = commentObj.likes?.some(like => like.toString() === userId.toString()) || false;
    delete commentObj.likes;

    return res.status(201).json(new ApiResponse(201, commentObj, 'Comment added'));
  }
});

// Share post
export const sharePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { platform, userId } = req.body;

  // console.log('share postId ', postId)
  // console.log('share body ', userId)

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
  const userId = req.body.userId;

  const post = await FeedPostModel.findById(postId)
    .populate({
      path: 'author',
      select: 'username displayName avatar role rating badge'
    })
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

 // Get community feed posts (simplified version for dashboard)
export const getCommunityFeed = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, userId, type, hashtag } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const query = { status: 'published' };
  if (type) query.type = type;
  if (hashtag) query['hashtags.tag'] = hashtag.toLowerCase();

  const posts = await FeedPostModel.find(query)
    .populate({
      path: 'author',
      select: 'username displayName avatar role rating badge personalInfo'
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();


  // Add engagement counts and interaction flags
  posts.forEach(post => {
    post.likeCount = post.likes?.length || 0;
    post.commentCount = post.comments?.length || 0;
    post.shareCount = post.shares?.length || 0;
    post.phone = post.author?.personalInfo?.phone || '';

    if (userId) {
      post.isLiked =
        post.likes?.some(like => like.user?.toString() === userId.toString()) || false;

      post.isSaved =
        post.savedBy?.some(saved => saved.user?.toString() === userId.toString()) || false;
    } else {
      post.isLiked = false;
      post.isSaved = false;
    }

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
        pagination: { page: parseInt(page), limit: parseInt(limit) }
      },
      'Community feed fetched successfully'
    )
  );
});

/* export const getCommunityFeed = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    userId,
    type,
    hashtag
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build query
  const query = { status: 'published' };
  if (type) query.type = type;
  if (hashtag) query['hashtags.tag'] = hashtag.toLowerCase();

  // Get posts
  const posts = await FeedPostModel.find(query)
    .populate({
      path: 'author',
      select: 'username displayName avatar role rating badge '
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();  // lean is fine, we'll add counts manually

    console.log('posts ', posts)

  // Add engagement counts and interaction flags
  if (userId) {
    posts.forEach(post => {
      // Add counts
      post.likeCount = post.likes?.length || 0;
      post.commentCount = post.comments?.length || 0;
      post.shareCount = post.shares?.length || 0;

      // Interaction flags
      post.isLiked = post.likes?.some(like => 
        like.user?.toString() === userId.toString()
      ) || false;
      post.isSaved = post.savedBy?.some(saved => 
        saved.user?.toString() === userId.toString()
      ) || false;

      // Remove arrays from response
      delete post.likes;
      delete post.savedBy;
      delete post.shares;
    });
  } else {
    posts.forEach(post => {
      post.likeCount = post.likes?.length || 0;
      post.commentCount = post.comments?.length || 0;
      post.shareCount = post.shares?.length || 0;
      post.isLiked = false;
      post.isSaved = false;
      delete post.likes;
      delete post.savedBy;
      delete post.shares;
    });
  } 

  // Get today's activity stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const postsToday = await FeedPostModel.countDocuments({
    ...query,
    createdAt: { $gte: today }
  });

  // Get trending hashtags (top 5)
  const trendingHashtags = await FeedPostModel.aggregate([
    { $unwind: '$hashtags' },
    { $match: { status: 'published' } },
    { $group: { _id: '$hashtags.tag', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
    { $project: { tag: '$_id', count: 1, _id: 0 } }
  ]);

  return res.status(200).json(
    new ApiResponse(200, {
      posts,
      stats: {
        postsToday,
        activeUsers: Math.floor(Math.random() * 50) + 20, // Mock for now
        totalEngagement: posts.reduce((sum, p) => sum + p.likeCount + p.commentCount + (p.shareCount || 0), 0),
        topHashtag: trendingHashtags[0]?.tag || ''
      },
      trendingHashtags,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    }, 'Community feed fetched successfully')
  );
});*/

// Get comments for a post with pagination
export const getPostComments = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  let { page = 1, limit = 20, userId } = req.query;
  page = parseInt(page);
  limit = parseInt(limit);

  const post = await FeedPostModel.findById(postId)
    .select('comments')
    .populate('comments.user', 'displayName username avatar')
    .populate('comments.replies.user', 'displayName username avatar')
    .lean();

  if (!post) throw new ApiError(404, 'Post not found');

  let allComments = post.comments || [];
  const start = (page - 1) * limit;
  const paginatedComments = allComments.slice(start, start + limit);

  // Process comments and replies
  const processed = paginatedComments.map(comment => {
    // Top-level comment
    const c = { ...comment };
    c.likeCount = c.likes?.length || 0;
    c.isLiked = userId ? (c.likes?.some(like => like.toString() === userId.toString()) || false) : false;
    delete c.likes;

    // Process replies
    if (c.replies && c.replies.length) {
      c.replies = c.replies.map(reply => {
        const r = { ...reply };
        r.likeCount = r.likes?.length || 0;
        r.isLiked = userId ? (r.likes?.some(like => like.toString() === userId.toString()) || false) : false;
        delete r.likes;
        return r;
      });
    }
    return c;
  });

  return res.status(200).json(
    new ApiResponse(200, {
      comments: processed,
      total: allComments.length,
      page,
      pages: Math.ceil(allComments.length / limit)
    }, 'Comments fetched successfully')
  );
});

// Like/Unlike comment (handles both top-level and nested)
export const toggleCommentLike = asyncHandler(async (req, res) => {
  const { postId, commentId } = req.params;
  const { userId } = req.body;

  const post = await FeedPostModel.findById(postId);
  if (!post) throw new ApiError(404, 'Post not found');

  // Find comment (top-level or nested)
  let foundComment = null;
  const topComment = post.comments.id(commentId);
  if (topComment) {
    foundComment = topComment;
  } else {
    for (const c of post.comments) {
      const reply = c.replies?.id(commentId);
      if (reply) {
        foundComment = reply;
        break;
      }
    }
  }
  if (!foundComment) throw new ApiError(404, 'Comment not found');

  const likeIndex = foundComment.likes.findIndex(like => like.toString() === userId.toString());
  if (likeIndex === -1) {
    foundComment.likes.push(userId);
  } else {
    foundComment.likes.splice(likeIndex, 1);
  }

  await post.save();

  // Populate user for response
  await FeedPostModel.populate(foundComment, { path: 'user', select: 'displayName username avatar' });

  const response = foundComment.toObject();
  response.likeCount = response.likes?.length || 0;
  response.isLiked = likeIndex === -1; // after toggle
  delete response.likes;

  return res.status(200).json(
    new ApiResponse(200, response, likeIndex === -1 ? 'Comment liked' : 'Comment unliked')
  );
});
