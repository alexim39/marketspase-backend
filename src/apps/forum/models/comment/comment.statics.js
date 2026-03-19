import { COMMENT_SORT, ERROR_MESSAGES } from "./comment.constants.js";
import { sortComments, buildCommentTree, formatCommentResponse } from "./comment.utils.js";

export const setupCommentStatics = (schema) => {
  // Get comments for a thread
  schema.statics.getForThread = async function(threadId, options = {}) {
    const {
      limit = 50,
      skip = 0,
      sortBy = COMMENT_SORT.NEWEST,
      includeReplies = true,
      userId = null,
      parentComment = null
    } = options;

    const query = {
      thread: threadId,
      isDeleted: false
    };

    // If parentComment is specified, get replies to that comment
    if (parentComment !== null) {
      query.parentComment = parentComment;
    } else if (!includeReplies) {
      // Only get root comments
      query.parentComment = { $exists: false };
    }

    let comments = await this.find(query)
      .populate('author', 'username displayName avatar')
      .populate('likedBy', 'username')
      .populate('mentions.user', 'username displayName')
      .populate({
        path: 'replies',
        populate: { path: 'author', select: 'username displayName avatar' }
      })
      .lean();

    // Sort comments
    comments = sortComments(comments, sortBy);

    // Format comments
    comments = comments.map(comment => formatCommentResponse(comment, userId));

    // Build tree if needed
    if (includeReplies && parentComment === null) {
      comments = buildCommentTree(comments);
    }

    // Get total count
    const total = await this.countDocuments({ thread: threadId, isDeleted: false });

    return {
      comments,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + comments.length < total
      }
    };
  };

  // Get replies for a comment
  schema.statics.getReplies = async function(commentId, options = {}) {
    const { limit = 20, skip = 0, userId = null } = options;

    const replies = await this.find({
      parentComment: commentId,
      isDeleted: false
    })
      .populate('author', 'username displayName avatar')
      .populate('likedBy', 'username')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const formattedReplies = replies.map(reply => formatCommentResponse(reply, userId));
    const total = await this.countDocuments({ parentComment: commentId, isDeleted: false });

    return {
      replies: formattedReplies,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + replies.length < total
      }
    };
  };

  // Get comments by user
  schema.statics.getByUser = async function(userId, options = {}) {
    const { limit = 20, skip = 0, threadId = null } = options;

    const query = {
      author: userId,
      isDeleted: false
    };

    if (threadId) {
      query.thread = threadId;
    }

    const comments = await this.find(query)
      .populate('thread', 'title slug')
      .populate('author', 'username displayName avatar')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const formattedComments = comments.map(comment => formatCommentResponse(comment, userId));
    const total = await this.countDocuments(query);

    return {
      comments: formattedComments,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + comments.length < total
      }
    };
  };

  // Create a new comment with validation
  schema.statics.createComment = async function(data) {
    const comment = new this(data);
    await comment.save();
    
    // Populate author for response
    await comment.populate('author', 'username displayName avatar').execPopulate();
    
    return comment;
  };

  // Create a reply to a comment
  schema.statics.createReply = async function(parentCommentId, data) {
    const parentComment = await this.findById(parentCommentId);
    
    if (!parentComment) {
      throw new Error(ERROR_MESSAGES.PARENT_COMMENT_NOT_FOUND);
    }

    if (parentComment.isDeleted) {
      throw new Error(ERROR_MESSAGES.CANNOT_REPLY_TO_DELETED);
    }

    const reply = new this({
      ...data,
      parentComment: parentCommentId,
      thread: parentComment.thread
    });

    await reply.save();
    await reply.populate('author', 'username displayName avatar').execPopulate();
    
    return reply;
  };

  // Get comment statistics
  schema.statics.getStats = async function(threadId = null) {
    const match = threadId ? { thread: threadId } : {};

    const stats = await this.aggregate([
      { $match: { ...match, isDeleted: false } },
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                totalComments: { $sum: 1 },
                totalLikes: { $sum: '$likeCount' },
                uniqueAuthors: { $addToSet: '$author' },
                rootComments: {
                  $sum: { $cond: [{ $eq: ['$parentComment', null] }, 1, 0] }
                },
                replies: {
                  $sum: { $cond: [{ $ne: ['$parentComment', null] }, 1, 0] }
                }
              }
            },
            {
              $project: {
                totalComments: 1,
                totalLikes: 1,
                uniqueAuthorCount: { $size: '$uniqueAuthors' },
                rootComments: 1,
                replies: 1
              }
            }
          ],
          topContributors: [
            {
              $group: {
                _id: '$author',
                commentCount: { $sum: 1 },
                totalLikesReceived: { $sum: '$likeCount' }
              }
            },
            { $sort: { commentCount: -1 } },
            { $limit: 10 },
            {
              $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'userDetails'
              }
            },
            { $unwind: '$userDetails' },
            {
              $project: {
                _id: 1,
                username: '$userDetails.username',
                displayName: '$userDetails.displayName',
                avatar: '$userDetails.avatar',
                commentCount: 1,
                totalLikesReceived: 1
              }
            }
          ],
          activityByDay: [
            {
              $group: {
                _id: {
                  date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id.date': -1 } },
            { $limit: 30 }
          ]
        }
      }
    ]);

    return stats[0];
  };

  // Search comments
  schema.statics.search = async function(query, options = {}) {
    const { limit = 20, skip = 0, threadId = null } = options;

    const searchQuery = {
      $text: { $search: query },
      isDeleted: false
    };

    if (threadId) {
      searchQuery.thread = threadId;
    }

    const comments = await this.find(searchQuery)
      .populate('author', 'username displayName avatar')
      .populate('thread', 'title slug')
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .skip(skip)
      .lean();

    const formattedComments = comments.map(comment => formatCommentResponse(comment));
    const total = await this.countDocuments(searchQuery);

    return {
      comments: formattedComments,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + comments.length < total
      }
    };
  };

  // Bulk delete comments (admin function)
  schema.statics.bulkDelete = async function(commentIds, deletedBy) {
    const result = await this.updateMany(
      { _id: { $in: commentIds } },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy,
          status: 'deleted',
          content: '[Comment deleted]'
        }
      }
    );

    return {
      modifiedCount: result.modifiedCount,
      message: `${result.modifiedCount} comments deleted`
    };
  };

  // Get flagged comments for moderation
  schema.statics.getFlaggedComments = async function() {
    return this.find({ status: 'flagged', isDeleted: false })
      .populate('author', 'username displayName email')
      .populate('flaggedBy.user', 'username displayName')
      .populate('thread', 'title slug')
      .sort({ 'flaggedBy.flaggedAt': -1 });
  };
};