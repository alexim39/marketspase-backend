import mongoose from 'mongoose';
import { NotificationService } from '../../notification/services/notification.service.js';
import { UserModel } from '../../user/models/user/index.js';
import { CommentModel } from '../models/comment/index.js';
import { ThreadModel } from '../models/thread/index.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toNumber = (value) => Number(value || 0);
const toLower = (value) => String(value || '').trim().toLowerCase();

export const parseJsonField = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const normalizeStringList = (value, { limit = 10, maxLength = 40 } = {}) => {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? parseJsonField(value, null) ?? value.split(',')
      : [];

  return [...new Set(source
    .map((entry) => toLower(entry))
    .filter(Boolean)
    .map((entry) => entry.slice(0, maxLength)))]
    .slice(0, limit);
};

const normalizePollOption = (option, index) => {
  const label = String(option?.label || option?.text || option || '').trim();
  if (!label) {
    return null;
  }

  return {
    optionId: String(option?.optionId || option?.id || `option-${index + 1}`),
    label: label.slice(0, 120),
    voteCount: 0,
    voters: [],
  };
};

export const normalizePollPayload = (value) => {
  const payload = parseJsonField(value, value);
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const question = String(payload.question || '').trim();
  const options = (Array.isArray(payload.options) ? payload.options : [])
    .map(normalizePollOption)
    .filter(Boolean)
    .slice(0, 6);

  if (!question || options.length < 2) {
    return null;
  }

  const closesAt = payload.closesAt ? new Date(payload.closesAt) : null;

  return {
    question: question.slice(0, 200),
    options,
    allowMultiple: Boolean(payload.allowMultiple),
    closesAt: closesAt && !Number.isNaN(closesAt.getTime()) ? closesAt : null,
    totalVotes: 0,
    isClosed: false,
  };
};

export const getThreadMediaItems = (thread = {}) => {
  if (Array.isArray(thread.mediaItems) && thread.mediaItems.length) {
    return [...thread.mediaItems];
  }

  if (thread.media?.url) {
    return [thread.media];
  }

  return [];
};

export const calculateForumTrendScore = (thread = {}) => {
  const createdAt = thread.createdAt ? new Date(thread.createdAt) : new Date();
  const hoursOld = Math.max(1, (Date.now() - createdAt.getTime()) / 3600000);
  const freshnessBoost = Math.max(0.35, 1.9 - (hoursOld / 72));
  const baseEngagement =
    (toNumber(thread.likeCount) * 3.2) +
    (toNumber(thread.commentCount) * 4.8) +
    (toNumber(thread.viewCount) * 0.7) +
    (toNumber(thread.shareCount) * 4.1) +
    (toNumber(thread.followerCount) * 1.8);

  const mediaBoost = getThreadMediaItems(thread).length ? 4 : 0;
  const pollBoost = thread.poll?.question ? 6 + (toNumber(thread.poll?.totalVotes) * 0.8) : 0;
  return Math.round((baseEngagement + mediaBoost + pollBoost) * freshnessBoost * 100) / 100;
};

export const buildThreadTopicTags = (thread = {}) => normalizeStringList([
  ...(thread.topicTags || []),
  ...(thread.tags || []),
  thread.category,
]);

const buildPollResponse = (poll, userId = null) => {
  if (!poll?.question) {
    return null;
  }

  const currentUserId = userId?.toString?.() || null;
  const options = (poll.options || []).map((option) => {
    const voterIds = (option.voters || []).map((entry) => entry?.toString?.()).filter(Boolean);
    return {
      optionId: option.optionId,
      label: option.label,
      voteCount: toNumber(option.voteCount),
      hasVoted: currentUserId ? voterIds.includes(currentUserId) : false,
    };
  });

  return {
    question: poll.question,
    options,
    allowMultiple: Boolean(poll.allowMultiple),
    closesAt: poll.closesAt || null,
    totalVotes: toNumber(poll.totalVotes),
    isClosed: Boolean(poll.isClosed) || (poll.closesAt ? new Date(poll.closesAt) < new Date() : false),
  };
};

export const shapeForumThread = (thread, userId = null) => {
  const raw = thread?.toObject ? thread.toObject({ virtuals: true }) : thread;
  const currentUserId = userId?.toString?.() || null;
  const mediaItems = getThreadMediaItems(raw);
  const followerIds = (raw.followers || []).map((entry) => entry?.toString?.()).filter(Boolean);
  const likeIds = (raw.likedBy || []).map((entry) => entry?.toString?.()).filter(Boolean);
  const trendScore = calculateForumTrendScore(raw);

  return {
    ...raw,
    media: mediaItems[0] || raw.media || null,
    mediaItems,
    mediaCount: mediaItems.length,
    hasMedia: mediaItems.length > 0,
    isCarousel: mediaItems.length > 1,
    topicTags: buildThreadTopicTags(raw),
    poll: buildPollResponse(raw.poll, currentUserId),
    followerCount: toNumber(raw.followerCount || followerIds.length),
    isFollowing: currentUserId ? followerIds.includes(currentUserId) : false,
    likeCount: toNumber(raw.likeCount || likeIds.length),
    commentCount: toNumber(raw.commentCount),
    viewCount: toNumber(raw.viewCount),
    shareCount: toNumber(raw.shareCount),
    engagementScore: Math.round(((toNumber(raw.likeCount) * 2) + (toNumber(raw.commentCount) * 3) + toNumber(raw.viewCount)) * 100) / 100,
    trendingScore: toNumber(raw.trendingScore || trendScore),
    spotlightScore: toNumber(raw.spotlightScore || trendScore),
    isLiked: currentUserId ? likeIds.includes(currentUserId) : Boolean(raw.isLiked),
  };
};

export const shapeForumComment = (comment, userId = null) => {
  const raw = comment?.toObject ? comment.toObject({ virtuals: true }) : comment;
  const currentUserId = userId?.toString?.() || null;
  const likeIds = (raw.likedBy || []).map((entry) => entry?.toString?.()).filter(Boolean);
  const replies = Array.isArray(raw.replies)
    ? raw.replies.map((reply) => shapeForumComment(reply, currentUserId))
    : [];

  return {
    ...raw,
    likeCount: toNumber(raw.likeCount || likeIds.length),
    replyCount: toNumber(raw.replyCount || replies.length),
    isLiked: currentUserId ? likeIds.includes(currentUserId) : Boolean(raw.isLiked),
    isReply: Boolean(raw.isReply || raw.parentComment),
    replies,
  };
};

export const loadThreadComments = async (threadId, userId = null) => {
  const comments = await CommentModel.find({
    thread: threadId,
    parentComment: null,
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .populate('author', 'displayName username avatar role badgeProfile gamificationProfile')
    .populate({
      path: 'replies',
      match: { isDeleted: false },
      options: { sort: { createdAt: 1 } },
      populate: {
        path: 'author',
        select: 'displayName username avatar role badgeProfile gamificationProfile',
      },
    })
    .lean();

  return comments.map((comment) => shapeForumComment(comment, userId));
};

export const getForumHotTopics = async ({ limit = 8, timeframeDays = 14 } = {}) => {
  const since = new Date();
  since.setDate(since.getDate() - timeframeDays);

  return ThreadModel.aggregate([
    {
      $match: {
        isDeleted: { $ne: true },
        createdAt: { $gte: since },
      },
    },
    {
      $project: {
        category: 1,
        tags: { $ifNull: ['$tags', []] },
        topicTags: { $ifNull: ['$topicTags', []] },
        likeCount: { $ifNull: ['$likeCount', 0] },
        commentCount: { $ifNull: ['$commentCount', 0] },
        viewCount: { $ifNull: ['$viewCount', 0] },
        followerCount: { $ifNull: ['$followerCount', 0] },
        createdAt: 1,
        combinedTopics: {
          $setUnion: [
            { $ifNull: ['$topicTags', []] },
            { $ifNull: ['$tags', []] },
            [{ $ifNull: ['$category', 'discussion'] }],
          ],
        },
      },
    },
    { $unwind: '$combinedTopics' },
    {
      $group: {
        _id: { $toLower: '$combinedTopics' },
        threadCount: { $sum: 1 },
        totalLikes: { $sum: '$likeCount' },
        totalComments: { $sum: '$commentCount' },
        totalViews: { $sum: '$viewCount' },
        followerCount: { $sum: '$followerCount' },
        latestActivityAt: { $max: '$createdAt' },
      },
    },
    {
      $addFields: {
        engagementScore: {
          $add: [
            { $multiply: ['$threadCount', 8] },
            { $multiply: ['$totalLikes', 2] },
            { $multiply: ['$totalComments', 3] },
            '$totalViews',
            { $multiply: ['$followerCount', 2] },
          ],
        },
      },
    },
    { $sort: { engagementScore: -1, latestActivityAt: -1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        topic: '$_id',
        label: '$_id',
        threadCount: 1,
        totalLikes: 1,
        totalComments: 1,
        totalViews: 1,
        followerCount: 1,
        latestActivityAt: 1,
        engagementScore: 1,
      },
    },
  ]);
};

export const getForumContributorSpotlight = async ({ limit = 5, timeframeDays = 14 } = {}) => {
  const since = new Date();
  since.setDate(since.getDate() - timeframeDays);

  const [threadContributors, commentContributors] = await Promise.all([
    ThreadModel.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: '$author',
          threadCount: { $sum: 1 },
          totalLikesReceived: { $sum: '$likeCount' },
          totalCommentsReceived: { $sum: '$commentCount' },
          totalViews: { $sum: '$viewCount' },
          lastActive: { $max: '$lastActivityAt' },
        },
      },
    ]),
    CommentModel.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: '$author',
          commentCount: { $sum: 1 },
          totalLikesReceived: { $sum: '$likeCount' },
          lastActive: { $max: '$createdAt' },
        },
      },
    ]),
  ]);

  const map = new Map();
  for (const contributor of threadContributors) {
    map.set(String(contributor._id), {
      userId: contributor._id,
      threadCount: toNumber(contributor.threadCount),
      commentCount: 0,
      totalLikesReceived: toNumber(contributor.totalLikesReceived),
      totalCommentsReceived: toNumber(contributor.totalCommentsReceived),
      totalViews: toNumber(contributor.totalViews),
      lastActive: contributor.lastActive,
    });
  }

  for (const contributor of commentContributors) {
    const key = String(contributor._id);
    const existing = map.get(key) || {
      userId: contributor._id,
      threadCount: 0,
      commentCount: 0,
      totalLikesReceived: 0,
      totalCommentsReceived: 0,
      totalViews: 0,
      lastActive: contributor.lastActive,
    };

    existing.commentCount += toNumber(contributor.commentCount);
    existing.totalLikesReceived += toNumber(contributor.totalLikesReceived);
    existing.lastActive = existing.lastActive && contributor.lastActive
      ? new Date(existing.lastActive) > new Date(contributor.lastActive) ? existing.lastActive : contributor.lastActive
      : existing.lastActive || contributor.lastActive;
    map.set(key, existing);
  }

  const userIds = [...map.values()].map((entry) => entry.userId);
  const users = await UserModel.find({
    _id: { $in: userIds },
    isDeleted: { $ne: true },
  })
    .select('displayName username avatar role badgeProfile gamificationProfile')
    .lean();

  const userLookup = new Map(users.map((user) => [String(user._id), user]));

  return [...map.values()]
    .map((entry) => {
      const user = userLookup.get(String(entry.userId));
      if (!user) return null;

      const engagementPoints =
        (entry.threadCount * 12) +
        (entry.commentCount * 5) +
        (entry.totalLikesReceived * 2) +
        (entry.totalCommentsReceived * 2) +
        Math.round(entry.totalViews / 10);

      return {
        _id: String(user._id),
        displayName: user.displayName || user.username || 'MarketSpase user',
        username: user.username || 'user',
        avatar: user.avatar || 'img/avatar.png',
        role: user.role || 'user',
        badge: user.gamificationProfile?.currentLevelTitle || user.badgeProfile?.levelTitle || '',
        threadCount: entry.threadCount,
        commentCount: entry.commentCount,
        engagementPoints,
        lastActive: entry.lastActive || null,
      };
    })
    .filter(Boolean)
    .sort((left, right) => (
      right.engagementPoints - left.engagementPoints ||
      right.threadCount - left.threadCount ||
      right.commentCount - left.commentCount
    ))
    .slice(0, limit);
};

export const getForumThreadHighlights = async ({ limit = 4, timeframeDays = 10, userId = null } = {}) => {
  const since = new Date();
  since.setDate(since.getDate() - timeframeDays);

  const threads = await ThreadModel.find({
    isDeleted: { $ne: true },
    createdAt: { $gte: since },
  })
    .populate('author', 'displayName username avatar role badgeProfile gamificationProfile')
    .sort({ isPinned: -1, pinnedAt: -1, lastActivityAt: -1, createdAt: -1 })
    .limit(Math.max(limit * 4, 16))
    .lean();

  return threads
    .map((thread) => shapeForumThread(thread, userId))
    .sort((left, right) => (
      toNumber(right.trendingScore || calculateForumTrendScore(right)) -
      toNumber(left.trendingScore || calculateForumTrendScore(left))
    ))
    .slice(0, limit);
};

export const toggleThreadFollowState = async (threadId, userId) => {
  const thread = await ThreadModel.findById(threadId).select('followers followerCount title').lean();
  if (!thread) {
    const error = new Error('Thread not found');
    error.status = 404;
    throw error;
  }

  const currentUserId = userId.toString();
  const followerIds = (thread.followers || []).map((entry) => entry?.toString?.()).filter(Boolean);
  const isFollowing = followerIds.includes(currentUserId);

  await Promise.all([
    ThreadModel.updateOne(
      { _id: threadId },
      isFollowing
        ? {
            $pull: { followers: userId },
            $inc: { followerCount: -1 },
          }
        : {
            $addToSet: { followers: userId },
            $inc: { followerCount: 1 },
          },
    ),
    UserModel.updateOne(
      { _id: userId },
      isFollowing
        ? { $pull: { 'forumActivity.followedThreads': threadId } }
        : { $addToSet: { 'forumActivity.followedThreads': threadId } },
    ),
  ]);

  const updated = await ThreadModel.findById(threadId)
    .populate('author', 'displayName username avatar role badgeProfile gamificationProfile')
    .lean();

  return {
    followed: !isFollowing,
    thread: shapeForumThread(updated, userId),
  };
};

export const toggleTopicFollowState = async (userId, topicValue) => {
  const topic = toLower(topicValue);
  if (!topic) {
    const error = new Error('Topic is required');
    error.status = 400;
    throw error;
  }

  const user = await UserModel.findById(userId).select('forumActivity.followedTopics').lean();
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const followedTopics = Array.isArray(user.forumActivity?.followedTopics)
    ? user.forumActivity.followedTopics.map((entry) => toLower(entry))
    : [];
  const isFollowing = followedTopics.includes(topic);

  await UserModel.updateOne(
    { _id: userId },
    isFollowing
      ? { $pull: { 'forumActivity.followedTopics': topic } }
      : { $addToSet: { 'forumActivity.followedTopics': topic } },
  );

  const followerCount = await UserModel.countDocuments({ 'forumActivity.followedTopics': topic });

  return {
    followed: !isFollowing,
    topic,
    followerCount,
  };
};

export const voteOnThreadPoll = async (threadId, userId, optionIds = []) => {
  const thread = await ThreadModel.findById(threadId);
  if (!thread) {
    const error = new Error('Thread not found');
    error.status = 404;
    throw error;
  }

  if (!thread.poll?.question || !Array.isArray(thread.poll.options) || thread.poll.options.length < 2) {
    const error = new Error('This thread does not have an active poll.');
    error.status = 400;
    throw error;
  }

  const now = new Date();
  const closed = thread.poll.isClosed || (thread.poll.closesAt && new Date(thread.poll.closesAt) < now);
  if (closed) {
    thread.poll.isClosed = true;
    await thread.save();
    const error = new Error('This poll is closed.');
    error.status = 400;
    throw error;
  }

  const normalizedOptionIds = [...new Set((Array.isArray(optionIds) ? optionIds : [optionIds])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean))];

  if (!normalizedOptionIds.length) {
    const error = new Error('Choose at least one option.');
    error.status = 400;
    throw error;
  }

  if (!thread.poll.allowMultiple && normalizedOptionIds.length > 1) {
    const error = new Error('This poll only allows one option.');
    error.status = 400;
    throw error;
  }

  const userKey = userId.toString();
  thread.poll.options.forEach((option) => {
    option.voters = (option.voters || []).filter((entry) => entry?.toString?.() !== userKey);
  });

  for (const optionId of normalizedOptionIds) {
    const option = thread.poll.options.find((entry) => entry.optionId === optionId);
    if (option && !(option.voters || []).some((entry) => entry?.toString?.() === userKey)) {
      option.voters.push(new mongoose.Types.ObjectId(userId));
    }
  }

  thread.poll.totalVotes = thread.poll.options.reduce((sum, option) => {
    option.voteCount = (option.voters || []).length;
    return sum + option.voteCount;
  }, 0);

  await thread.save();

  const updated = await ThreadModel.findById(threadId)
    .populate('author', 'displayName username avatar role badgeProfile gamificationProfile')
    .lean();

  return shapeForumThread(updated, userId);
};

export const notifyForumFollowers = async ({
  thread,
  actorId,
  actorDisplayName,
  eventType,
  previewText = '',
}) => {
  const threadId = thread?._id?.toString?.();
  if (!threadId) return;

  const topicTags = buildThreadTopicTags(thread);
  const actorKey = actorId?.toString?.();
  const recipientIds = new Set();
  const authorId = thread.author?._id?.toString?.() || thread.author?.toString?.();

  if (authorId && authorId !== actorKey) {
    recipientIds.add(authorId);
  }

  (thread.followers || []).forEach((entry) => {
    const id = entry?.toString?.();
    if (id && id !== actorKey) {
      recipientIds.add(id);
    }
  });

  if (topicTags.length) {
    const topicFollowers = await UserModel.find({
      _id: { $ne: actorId },
      'forumActivity.followedTopics': { $in: topicTags },
    })
      .select('_id')
      .lean();

    topicFollowers.forEach((user) => recipientIds.add(String(user._id)));
  }

  const recipients = [...recipientIds];
  if (!recipients.length) return;

  const title = eventType === 'new_thread'
    ? 'New forum topic in your interests'
    : eventType === 'new_reply'
      ? 'New reply in a thread you follow'
      : 'New discussion activity';

  const message = eventType === 'new_thread'
    ? `${actorDisplayName} started "${thread.title}".`
    : `${actorDisplayName} added a new reply in "${thread.title}".`;

  await Promise.allSettled(recipients.map((recipient) => (
    NotificationService.createNotification({
      recipient,
      type: 'forum_activity',
      title,
      message: previewText ? `${message} ${previewText}` : message,
      data: {
        threadId,
        actionUrl: `/dashboard/community/discussion/${threadId}`,
        metadata: {
          eventType,
          threadTitle: thread.title,
          topicTags,
        },
      },
      priority: 'medium',
    })
  )));
};
