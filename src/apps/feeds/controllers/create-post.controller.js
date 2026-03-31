import { FeedPostModel } from '../models/feed/index.js';
import { UserModel } from '../../user/models/user/index.js';
import { CampaignModel } from '../../campaign/models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Create feed post
// Create campaign update post (for marketers)
export const createFeedPost = asyncHandler(async (req, res) => {
  const { content, campaignId, hashtags, userId, settings } = req.body;

  // Get user details
  const user = await UserModel.findById(userId).select('username displayName avatar role activitySettings activityLog');
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
    resourceId: post._id,
    metadata: { campaignId: campaign._id }
  });

  return res.status(201).json(
    new ApiResponse(201, post, 'Campaign feed created successfully')
  );
});