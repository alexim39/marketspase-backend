import { UserModel } from '../../../user/models/user/index.js';
import { CommentModel } from '../../models/comment/index.js';
import { ThreadModel } from '../../models/thread/index.js';
import { ForumStatsGateway } from '../../application/ports/forum-stats.gateway.js';
import {
  getForumContributorSpotlight,
  getForumHotTopics,
  getForumThreadHighlights,
  shapeForumThread,
} from '../../services/forum-social.service.js';

export class MongooseForumStatsGateway extends ForumStatsGateway {
  async getCommunityStats({ today } = {}) {
    const [
      totalMembers,
      totalDiscussions,
      totalComments,
      todayDiscussions,
      todayComments,
    ] = await Promise.all([
      UserModel.countDocuments({ isActive: true, isDeleted: false }),
      ThreadModel.countDocuments({ isDeleted: { $ne: true } }),
      CommentModel.countDocuments({ isDeleted: { $ne: true } }),
      ThreadModel.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: today } }),
      CommentModel.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: today } }),
    ]);

    return {
      totalMembers,
      totalDiscussions,
      totalComments,
      todayDiscussions,
      todayComments,
    };
  }

  async listPinnedThreads({ limit = 5, userId = null } = {}) {
    const threads = await ThreadModel.find({
      isPinned: true,
      isDeleted: { $ne: true },
    })
      .populate('author', 'displayName username avatar role badgeProfile gamificationProfile')
      .sort({ pinOrder: 1, pinnedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return threads.map((thread) => shapeForumThread(thread, userId));
  }

  async getThreadHighlights({ limit = 5, timeframeDays = 7, userId = null } = {}) {
    return getForumThreadHighlights({
      limit,
      timeframeDays,
      userId,
    });
  }

  async getContributorSpotlight({ limit = 5, timeframeDays = 30 } = {}) {
    return getForumContributorSpotlight({
      limit,
      timeframeDays,
    });
  }

  async getHotTopics({ limit = 8, timeframeDays = 7 } = {}) {
    return getForumHotTopics({
      limit,
      timeframeDays,
    });
  }
}
