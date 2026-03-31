import { generateSlug, extractMentions, extractHashtags } from "./thread.utils.js";
import mongoose from "mongoose";

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