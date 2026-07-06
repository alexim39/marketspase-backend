import { FeedPostModel } from '../models/feed/index.js';
import { UserModel } from '../../user/models/user/index.js';

export async function repostFeedPost(req, res) {
  try {
    const { postId } = req.params;
    const userId = req.userId;

    const original = await FeedPostModel.findById(postId).lean();
    if (!original) return res.status(404).json({ success: false, message: 'Post not found' });

    const repost = await FeedPostModel.create({
      author: userId,
      content: original.content,
      source: 'manual',
      type: 'story',
      media: original.media || [],
      campaign: original.campaign || null,
      product: original.product || null,
      settings: { postAnonymously: false, disableComments: false, allowExternalShare: true },
      hashtags: original.hashtags || [],
      isRepost: true,
      repostedFrom: postId,
      repostedAuthor: original.author
    });

    // Increment share count on original
    await FeedPostModel.findByIdAndUpdate(postId, {
      $inc: { 'engagementStats.shares': 1, 'engagementStats.totalEngagement': 1, shareCount: 1 },
      $push: { shares: { user: userId, platform: 'marketspase', sharedAt: new Date() } }
    });

    return res.status(201).json({ success: true, data: repost });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
