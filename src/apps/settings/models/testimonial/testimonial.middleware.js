import { validateMessage, validateRating } from "./testimonial.utils.js";
import mongoose from "mongoose";

export const setupTestimonialMiddleware = (schema) => {
  // Pre-save middleware
  schema.pre('save', function(next) {
    // Validate message
    if (this.isModified('message')) {
      const validation = validateMessage(this.message);
      if (!validation.isValid) {
        return next(new Error(validation.error));
      }
      this.message = validation.message;
    }

    // Validate rating
    if (this.isModified('rating')) {
      const validation = validateRating(this.rating);
      if (!validation.isValid) {
        return next(new Error(validation.error));
      }
      this.rating = validation.rating;
    }

    // Ensure likes and dislikes match reactions array
    if (this.isModified('reactions')) {
      const likes = this.reactions.filter(r => r.reaction === 'like').length;
      const dislikes = this.reactions.filter(r => r.reaction === 'dislike').length;
      
      this.likes = likes;
      this.dislikes = dislikes;
    }

    // Set deletedAt when isDeleted changes to true
    if (this.isModified('isDeleted') && this.isDeleted && !this.deletedAt) {
      this.deletedAt = new Date();
    }

    next();
  });

  // Pre-update middleware
  schema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();

    // Validate message if being updated
    if (update.message) {
      const validation = validateMessage(update.message);
      if (!validation.isValid) {
        return next(new Error(validation.error));
      }
      update.message = validation.message;
    }

    // Validate rating if being updated
    if (update.rating) {
      const validation = validateRating(update.rating);
      if (!validation.isValid) {
        return next(new Error(validation.error));
      }
      update.rating = validation.rating;
    }

    next();
  });

  // Post-save middleware
  schema.post('save', function(doc) {
    // Could emit events for real-time updates
    // emit('testimonial.saved', doc);
  });

  // FIXED: Post-find middleware to populate user
  schema.post(/^find/, async function(result) {
    if (!result) return;

    const UserModel = mongoose.model('User');
    
    const populateFields = async (item) => {
      // Check if it's a Mongoose document (has populate method)
      if (item && typeof item.populate === 'function') {
        // It's a document - use populate with array syntax (Mongoose 6+)
        await item.populate([
          { path: 'user', select: 'username displayName avatar' },
          { path: 'reviewedBy', select: 'username' },
          { path: 'reactions.userId', select: 'username' }
        ]);
      } 
      // If it's a plain object (from lean()) or we need to populate manually
      else if (item && item.user) {
        // Manual population for lean objects
        if (item.user && typeof item.user === 'object' && !item.user.username) {
          const user = await UserModel.findById(item.user)
            .select('username displayName avatar')
            .lean();
          if (user) item.user = user;
        }
        
        // Populate reviewedBy if it exists and is an ID
        if (item.reviewedBy && typeof item.reviewedBy === 'object' && !item.reviewedBy.username) {
          const reviewer = await UserModel.findById(item.reviewedBy)
            .select('username')
            .lean();
          if (reviewer) item.reviewedBy = reviewer;
        }
        
        // Populate reactions.userId
        if (item.reactions && Array.isArray(item.reactions)) {
          for (let i = 0; i < item.reactions.length; i++) {
            const reaction = item.reactions[i];
            if (reaction.userId && typeof reaction.userId === 'object' && !reaction.userId.username) {
              const user = await UserModel.findById(reaction.userId)
                .select('username')
                .lean();
              if (user) reaction.userId = user;
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
};