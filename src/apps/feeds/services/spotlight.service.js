import { FeedPostModel } from '../models/feed/index.js';
import { SpotlightConfigModel } from '../models/spotlight-config.model.js';
import { shapeFeedPost } from './feed-discovery.service.js';

/**
 * Compute the active spotlight index based on elapsed time since last rotation.
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

  // Persist asynchronously — no need to await for feed response speed
  SpotlightConfigModel.findByIdAndUpdate(config._id, {
    currentIndex: newIndex,
    lastRotatedAt: new Date(lastRotatedAt.getTime() + rotationsPassed * intervalMs)
  }).catch((err) => {
    console.error('Failed to persist spotlight rotation index:', err.message);
  });

  return newIndex;
}

/**
 * Get the current spotlight configuration and active post.
 * Returns null for config if no spotlight is configured.
 */
export async function getSpotlightData(userId = null) {
  try {
    const config = await SpotlightConfigModel.findOne().sort({ createdAt: -1 }).exec();
    if (!config || !config.postIds || config.postIds.length === 0) {
      return { config: null, activePost: null };
    }

    const activeIndex = computeActiveIndex(config);
    if (activeIndex < 0 || activeIndex >= config.postIds.length) {
      return { config: null, activePost: null };
    }

    const activePostId = config.postIds[activeIndex];
    const post = await FeedPostModel.findById(activePostId)
      .populate('author', 'username displayName avatar role isVerified personalInfo')
      .lean();

    if (!post) {
      return { config: null, activePost: null };
    }

    return {
      config: {
        postIds: config.postIds,
        intervalMinutes: config.intervalMinutes,
        currentIndex: activeIndex,
        lastRotatedAt: config.lastRotatedAt,
        totalPosts: config.postIds.length
      },
      activePost: shapeFeedPost(post, userId)
    };
  } catch (error) {
    console.error('Error fetching spotlight data:', error.message);
    return { config: null, activePost: null };
  }
}
