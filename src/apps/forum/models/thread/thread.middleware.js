import { generateSlug, extractMentions, extractHashtags } from "./thread.utils.js";
import mongoose from "mongoose";

const getThreadMediaItems = (thread) => {
  if (Array.isArray(thread?.mediaItems) && thread.mediaItems.length) {
    return thread.mediaItems;
  }

  if (thread?.media?.url) {
    return [thread.media];
  }

  return [];
};

const calculateForumTrendScore = (thread = {}) => {
  const createdAt = thread.createdAt ? new Date(thread.createdAt) : new Date();
  const hoursOld = Math.max(1, (Date.now() - createdAt.getTime()) / 3600000);
  const freshnessBoost = Math.max(0.35, 1.9 - (hoursOld / 72));
  const baseEngagement =
    ((thread.likeCount || 0) * 3.2) +
    ((thread.commentCount || 0) * 4.8) +
    ((thread.viewCount || 0) * 0.7) +
    ((thread.shareCount || 0) * 4.1) +
    ((thread.followerCount || 0) * 1.8);

  const mediaBoost = getThreadMediaItems(thread).length ? 4 : 0;
  const pollBoost = thread.poll?.question ? 6 + ((thread.poll?.totalVotes || 0) * 0.8) : 0;
  return Math.round((baseEngagement + mediaBoost + pollBoost) * freshnessBoost * 100) / 100;
};

export const setupThreadMiddleware = (schema) => {
  // Pre-save middleware
  schema.pre('save', async function(next) {
    // Generate slug if title is modified
    if (this.isModified('title') && this.title) {
      this.slug = generateSlug(this.title);
    }

    // Ensure commentCount never drops below 0
    if (this.isModified('commentCount')) {
      this.commentCount = Math.max(0, this.commentCount);
    }

    // Ensure likeCount matches likedBy array
    if (this.isModified('likedBy')) {
      this.likeCount = this.likedBy?.length || 0;
    }

    if (this.isModified('followers')) {
      this.followerCount = this.followers?.length || 0;
    }

    if (this.isModified('mediaItems')) {
      const mediaItems = Array.isArray(this.mediaItems) ? this.mediaItems : [];
      this.media = mediaItems[0] || this.media || null;
    }

    if (this.isModified('media') && (!Array.isArray(this.mediaItems) || this.mediaItems.length === 0) && this.media?.url) {
      this.mediaItems = [this.media];
    }

    // Update lastActivityAt
    if (this.isModified()) {
      this.lastActivityAt = new Date();
    }

    // Extract mentions from content
    if (this.isModified('content') && this.content) {
      const mentions = extractMentions(this.content);
      if (mentions.length > 0) {
        const UserModel = mongoose.model('User');
        const users = await UserModel.find({ username: { $in: mentions } });
        
        this.mentions = users.map(user => ({
          user: user._id,
          username: user.username
        }));
      }

      // Extract hashtags
      const hashtags = extractHashtags(this.content);
      this.hashtags = hashtags.map(tag => ({ tag }));
    }

    if (this.isModified('topicTags') || this.isModified('tags') || this.isModified('category')) {
      const combined = new Set([
        ...(this.topicTags || []).map((tag) => String(tag || '').trim().toLowerCase()).filter(Boolean),
        ...(this.tags || []).map((tag) => String(tag || '').trim().toLowerCase()).filter(Boolean),
      ]);

      if (this.category) {
        combined.add(String(this.category).trim().toLowerCase());
      }

      this.topicTags = [...combined].slice(0, 8);
    }

    if (this.poll?.question) {
      const hasOpenOptions = Array.isArray(this.poll.options) && this.poll.options.length >= 2;
      if (!hasOpenOptions) {
        this.poll = null;
      } else {
        this.poll.isClosed = Boolean(this.poll.isClosed) || Boolean(this.poll.closesAt && new Date(this.poll.closesAt) < new Date());
        this.poll.totalVotes = (this.poll.options || []).reduce((sum, option) => sum + (option.voters?.length || option.voteCount || 0), 0);
      }
    }

    this.engagementScore = Math.round((((this.likeCount || 0) * 2) + ((this.commentCount || 0) * 3) + (this.viewCount || 0) + ((this.shareCount || 0) * 3)) * 100) / 100;
    this.trendingScore = calculateForumTrendScore(this);
    this.spotlightScore = (this.engagementScore || 0) + ((getThreadMediaItems(this).length || 0) * 4) + (this.poll?.question ? 5 : 0);

    // Set deletedAt when isDeleted changes to true
    if (this.isModified('isDeleted') && this.isDeleted && !this.deletedAt) {
      this.deletedAt = new Date();
    }

    next();
  });

  // Pre-findOneAndUpdate middleware
  schema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();

    // Update lastActivityAt
    update.lastActivityAt = new Date();

    // Handle slug generation if title is updated
    if (update.title) {
      update.slug = generateSlug(update.title);
    }

    // Ensure commentCount is valid
    if (update.commentCount !== undefined) {
      update.commentCount = Math.max(0, update.commentCount);
    }

    if (update.followers !== undefined) {
      update.followerCount = Array.isArray(update.followers) ? update.followers.length : update.followerCount;
    }

    next();
  });

  // Post-save middleware
  schema.post('save', function(doc) {
    // Create notifications for mentions
    if (doc.mentions && doc.mentions.length > 0) {
      // Queue mention notifications
      // This would be handled by a notification service
    }
  });

  // FIXED: Post-find middleware - handle both documents and lean objects
  schema.post(/^find/, async function(result) {
    if (!result) return;

    const UserModel = mongoose.model('User');
    
    // Helper function to populate a single document/object
    const populateFields = async (item) => {
      // Check if it's a Mongoose document (has populate method)
      if (item && typeof item.populate === 'function') {
        // It's a document - use populate (Mongoose 6+ syntax)
        await item.populate([
          { path: 'author', select: 'username displayName avatar' },
          { path: 'lastCommentBy', select: 'username displayName' },
          { path: 'likedBy', select: 'username' },
          { path: 'mentions.user', select: 'username displayName' }
        ]);
      } 
      // If it's a plain object (from lean()) or we need to populate manually
      else if (item && item.author) {
        // Manual population for lean objects
        if (item.author && typeof item.author === 'object' && !item.author.username) {
          const author = await UserModel.findById(item.author).select('username displayName avatar').lean();
          if (author) item.author = author;
        }
        
        if (item.lastCommentBy && typeof item.lastCommentBy === 'object' && !item.lastCommentBy.username) {
          const lastCommentBy = await UserModel.findById(item.lastCommentBy).select('username displayName').lean();
          if (lastCommentBy) item.lastCommentBy = lastCommentBy;
        }
        
        if (item.likedBy && Array.isArray(item.likedBy)) {
          const populatedLikedBy = [];
          for (let i = 0; i < item.likedBy.length; i++) {
            const likeItem = item.likedBy[i];
            if (likeItem && typeof likeItem === 'object' && !likeItem.username) {
              const user = await UserModel.findById(likeItem).select('username').lean();
              if (user) populatedLikedBy.push(user);
            } else {
              populatedLikedBy.push(likeItem);
            }
          }
          item.likedBy = populatedLikedBy;
        }
        
        if (item.mentions && Array.isArray(item.mentions)) {
          for (let i = 0; i < item.mentions.length; i++) {
            const mention = item.mentions[i];
            if (mention && mention.user && typeof mention.user === 'object' && !mention.user.username) {
              const user = await UserModel.findById(mention.user).select('username displayName').lean();
              if (user) mention.user = user;
            }
          }
        }
      }
    };

    // Handle both arrays and single documents
    if (Array.isArray(result)) {
      await Promise.all(result.map(item => populateFields(item)));
    } else {
      await populateFields(result);
    }
  });

  // Pre-delete middleware (cascade delete)
  schema.pre('deleteOne', { document: true }, async function(next) {
    const CommentModel = mongoose.model('Forumcomment');
    await CommentModel.deleteMany({ thread: this._id });
    next();
  });

  // Pre-remove middleware (for when document is removed)
  schema.pre('remove', async function(next) {
    const CommentModel = mongoose.model('Forumcomment');
    await CommentModel.deleteMany({ thread: this._id });
    next();
  });
};
