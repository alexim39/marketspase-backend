import { ERROR_MESSAGES } from "./comment.constants.js";
import { validateContent, formatCommentResponse } from "./comment.utils.js";

export const setupCommentMethods = (schema) => {
  // Check if user liked the comment
  schema.methods.isLikedBy = function(userId) {
    return this.likedBy.some(id => id.toString() === userId.toString());
  };

  // Add like to comment
  schema.methods.addLike = async function(userId) {
    if (this.isLikedBy(userId)) {
      throw new Error(ERROR_MESSAGES.ALREADY_LIKED);
    }

    this.likedBy.push(userId);
    this.likeCount = this.likedBy.length;
    
    await this.save();
    return this;
  };

  // Remove like from comment
  schema.methods.removeLike = async function(userId) {
    if (!this.isLikedBy(userId)) {
      throw new Error(ERROR_MESSAGES.NOT_LIKED);
    }

    this.likedBy = this.likedBy.filter(id => id.toString() !== userId.toString());
    this.likeCount = this.likedBy.length;
    
    await this.save();
    return this;
  };

  // Update comment content
  schema.methods.updateContent = async function(newContent, userId) {
    const validation = validateContent(newContent);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Save to edit history
    this.editHistory.push({
      content: this.content,
      editedAt: new Date(),
      editedBy: userId
    });

    this.content = validation.content;
    this.isEdited = true;
    this.lastEditedAt = new Date();
    
    await this.save();
    return this;
  };

  // Soft delete comment
  schema.methods.softDelete = async function(deletedBy) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = deletedBy;
    this.status = 'deleted';
    this.content = '[Comment deleted]';
    
    await this.save();
    return this;
  };

  // Restore soft-deleted comment
  schema.methods.restore = async function() {
    this.isDeleted = false;
    this.deletedAt = null;
    this.deletedBy = null;
    this.status = 'active';
    
    await this.save();
    return this;
  };

  // Flag comment for moderation
  schema.methods.flag = async function(userId, reason) {
    // Check if already flagged by this user
    const alreadyFlagged = this.flaggedBy.some(
      flag => flag.user.toString() === userId.toString()
    );

    if (!alreadyFlagged) {
      this.flaggedBy.push({
        user: userId,
        reason,
        flaggedAt: new Date()
      });
    }

    this.status = 'flagged';
    await this.save();
    return this;
  };

  // Moderate comment (admin action)
  schema.methods.moderate = async function(action, moderatorId, reason) {
    switch (action) {
      case 'approve':
        this.status = 'active';
        this.flaggedBy = [];
        break;
      
      case 'hide':
        this.status = 'hidden';
        break;
      
      case 'delete':
        await this.softDelete(moderatorId);
        break;
    }

    this.metadata = {
      ...this.metadata,
      lastModeratedAt: new Date(),
      moderatedBy: moderatorId,
      moderationReason: reason
    };

    await this.save();
    return this;
  };

  // Add reply to this comment
  schema.methods.addReply = async function(replyData) {
    // This method would create a new comment with this as parent
    const CommentModel = mongoose.model('Forumcomment');
    
    const reply = new CommentModel({
      ...replyData,
      parentComment: this._id,
      thread: this.thread
    });

    await reply.save();
    return reply;
  };

  // Get reply count
  schema.methods.getReplyCount = async function() {
    const CommentModel = mongoose.model('Forumcomment');
    return CommentModel.countDocuments({
      parentComment: this._id,
      isDeleted: false
    });
  };

  // Get formatted response
  schema.methods.toResponse = function(userId = null) {
    return formatCommentResponse(this, userId);
  };

  // Add mention
  schema.methods.addMention = function(userId, username) {
    if (!this.mentions.some(m => m.user?.toString() === userId.toString())) {
      this.mentions.push({ user: userId, username });
    }
    return this;
  };

  // Add hashtag
  schema.methods.addHashtag = function(tag) {
    const existingTag = this.hashtags.find(h => h.tag === tag);
    if (existingTag) {
      existingTag.count += 1;
    } else {
      this.hashtags.push({ tag });
    }
    return this;
  };
};