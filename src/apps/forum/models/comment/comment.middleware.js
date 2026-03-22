import { validateContent, extractMentions, extractHashtags, extractUrls } from "./comment.utils.js";

export const setupCommentMiddleware = (schema) => {
  // Pre-save middleware
  schema.pre('save', async function(next) {
    // Validate content
    if (this.isModified('content')) {
      const validation = validateContent(this.content);
      if (!validation.isValid) {
        return next(new Error(validation.error));
      }
      this.content = validation.content;

      // Extract mentions
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

      // Extract URLs for metadata
      const urls = extractUrls(this.content);
      if (urls.length > 0) {
        this.metadata = {
          ...this.metadata,
          containsUrls: true,
          urls
        };
      }
    }

    // Ensure likeCount matches likedBy array
    if (this.isModified('likedBy')) {
      this.likeCount = this.likedBy.length;
    }

    // Set deletedAt when isDeleted changes to true
    if (this.isModified('isDeleted') && this.isDeleted && !this.deletedAt) {
      this.deletedAt = new Date();
    }

    next();
  });

  // Pre-findOneAndUpdate middleware
  schema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();

    // If content is being updated, we need to validate
    if (update.content) {
      const validation = validateContent(update.content);
      if (!validation.isValid) {
        return next(new Error(validation.error));
      }
      update.content = validation.content;
    }

    // Update timestamps
    update.updatedAt = new Date();

    next();
  });

  // Pre-delete middleware
  schema.pre('remove', async function(next) {
    // Delete all replies when a comment is deleted
    const CommentModel = mongoose.model('Forumcomment');
    await CommentModel.updateMany(
      { parentComment: this._id },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          content: '[Comment deleted]'
        }
      }
    );
    
    next();
  });
};