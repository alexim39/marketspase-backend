import { ERROR_MESSAGES } from "./thread.constants.js";
import { formatThreadResponse, validateTitle, validateContent } from "./thread.utils.js";

export const setupThreadMethods = (schema) => {
  // Check if user liked the thread
  schema.methods.isLikedBy = function(userId) {
    return this.likedBy?.some(id => id.toString() === userId.toString()) || false;
  };

  // Add like to thread
  schema.methods.addLike = async function(userId) {
    if (this.isLikedBy(userId)) {
      throw new Error(ERROR_MESSAGES.ALREADY_LIKED);
    }

    this.likedBy = this.likedBy || [];
    this.likedBy.push(userId);
    this.likeCount = this.likedBy.length;
    
    this.lastActivityAt = new Date();
    await this.save();
    return this;
  };

  // Remove like from thread
  schema.methods.removeLike = async function(userId) {
    if (!this.isLikedBy(userId)) {
      throw new Error(ERROR_MESSAGES.NOT_LIKED);
    }

    this.likedBy = this.likedBy.filter(id => id.toString() !== userId.toString());
    this.likeCount = this.likedBy.length;
    
    this.lastActivityAt = new Date();
    await this.save();
    return this;
  };

  // Increment view count
  schema.methods.incrementView = async function(userId = null) {
    this.viewCount += 1;
    this.lastActivityAt = new Date();
    await this.save();
    return this;
  };

  // Update thread content
  schema.methods.updateContent = async function(updates, userId) {
    if (this.author.toString() !== userId.toString()) {
      throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
    }

    if (this.isLocked) {
      throw new Error(ERROR_MESSAGES.THREAD_LOCKED);
    }

    if (updates.title) {
      const titleValidation = validateTitle(updates.title);
      if (!titleValidation.isValid) {
        throw new Error(titleValidation.error);
      }
      this.title = titleValidation.title;
    }

    if (updates.content) {
      const contentValidation = validateContent(updates.content);
      if (!contentValidation.isValid) {
        throw new Error(contentValidation.error);
      }
      this.content = contentValidation.content;
    }

    if (updates.tags !== undefined) {
      this.tags = updates.tags;
    }

    if (updates.category) {
      this.category = updates.category;
    }

    if (updates.media) {
      this.media = updates.media;
    }

    this.lastActivityAt = new Date();
    await this.save();
    return this;
  };

  // Lock thread
  schema.methods.lock = async function(userId) {
    if (this.isLocked) {
      return this;
    }

    this.isLocked = true;
    this.lockedAt = new Date();
    this.lockedBy = userId;
    this.lastActivityAt = new Date();
    
    await this.save();
    return this;
  };

  // Unlock thread
  schema.methods.unlock = async function(userId) {
    if (!this.isLocked) {
      return this;
    }

    this.isLocked = false;
    this.lockedAt = null;
    this.lockedBy = null;
    this.lastActivityAt = new Date();
    
    await this.save();
    return this;
  };

  // Pin thread
  schema.methods.pin = async function(userId) {
    if (this.isPinned) {
      throw new Error(ERROR_MESSAGES.ALREADY_PINNED);
    }

    this.isPinned = true;
    this.pinnedAt = new Date();
    this.pinnedBy = userId;
    this.lastActivityAt = new Date();
    
    await this.save();
    return this;
  };

  // Unpin thread
  schema.methods.unpin = async function() {
    if (!this.isPinned) {
      throw new Error(ERROR_MESSAGES.NOT_PINNED);
    }

    this.isPinned = false;
    this.pinnedAt = null;
    this.pinnedBy = null;
    this.lastActivityAt = new Date();
    
    await this.save();
    return this;
  };

  // Soft delete thread
  schema.methods.softDelete = async function(deletedBy) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = deletedBy;
    this.status = 'deleted';
    
    await this.save();
    return this;
  };

  // Restore soft-deleted thread
  schema.methods.restore = async function() {
    this.isDeleted = false;
    this.deletedAt = null;
    this.deletedBy = null;
    this.status = 'active';
    
    await this.save();
    return this;
  };

  // Update comment count
  schema.methods.updateCommentCount = async function(increment = 1, userId = null) {
    this.commentCount = Math.max(0, this.commentCount + increment);
    this.lastActivityAt = new Date();
    
    if (userId) {
      this.lastCommentBy = userId;
      this.lastCommentAt = new Date();
    }
    
    await this.save();
    return this;
  };

  // Check if user can comment (FIXED: renamed from canComment to canUserComment)
  schema.methods.canUserComment = function(userId) {
    if (this.isLocked) {
      return { allowed: false, reason: ERROR_MESSAGES.THREAD_LOCKED };
    }
    
    if (this.isDeleted) {
      return { allowed: false, reason: ERROR_MESSAGES.THREAD_DELETED };
    }
    
    return { allowed: true };
  };

  // Get thread summary
  schema.methods.getSummary = function() {
    return {
      id: this._id,
      title: this.title,
      excerpt: this.excerpt,
      author: this.author,
      category: this.category,
      likeCount: this.likeCount,
      commentCount: this.commentCount,
      viewCount: this.viewCount,
      isPinned: this.isPinned,
      isLocked: this.isLocked,
      createdAt: this.createdAt,
      timeAgo: this.timeAgo,
      lastActivityAt: this.lastActivityAt,
      hasMedia: this.hasMedia,
      tags: this.tags
    };
  };

  // Get formatted response
  schema.methods.toResponse = function(userId = null) {
    return formatThreadResponse(this, userId);
  };

  // Add mention
  schema.methods.addMention = function(userId, username) {
    this.mentions = this.mentions || [];
    if (!this.mentions.some(m => m.user?.toString() === userId.toString())) {
      this.mentions.push({ user: userId, username });
    }
    return this;
  };

  // Add hashtag
  schema.methods.addHashtag = function(tag) {
    this.hashtags = this.hashtags || [];
    const existingTag = this.hashtags.find(h => h.tag === tag);
    if (existingTag) {
      existingTag.count += 1;
    } else {
      this.hashtags.push({ tag });
    }
    return this;
  };
};