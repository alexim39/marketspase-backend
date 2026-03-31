import mongoose from "mongoose";
import { validateRating, validateComment, validateTitle } from "./review.utils.js";

export const setupReviewMiddleware = (schema) => {
  // Pre-save middleware
  schema.pre('save', function(next) {
    // Validate rating
    if (this.isModified('rating')) {
      const validation = validateRating(this.rating);
      if (!validation.isValid) {
        return next(new Error(validation.error));
      }
      this.rating = validation.rating;
    }

    // Validate comment
    if (this.isModified('comment')) {
      const validation = validateComment(this.comment);
      if (!validation.isValid) {
        return next(new Error(validation.error));
      }
      this.comment = validation.comment;
    }

    // Validate title
    if (this.isModified('title')) {
      const validation = validateTitle(this.title);
      if (!validation.isValid) {
        return next(new Error(validation.error));
      }
      this.title = validation.title;
    }

    // Update updatedAt
    this.updatedAt = new Date();

    next();
  });

  // Pre-update middleware
  schema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();

    // Validate rating if being updated
    if (update.rating) {
      const validation = validateRating(update.rating);
      if (!validation.isValid) {
        return next(new Error(validation.error));
      }
      update.rating = validation.rating;
    }

    // Validate comment if being updated
    if (update.comment) {
      const validation = validateComment(update.comment);
      if (!validation.isValid) {
        return next(new Error(validation.error));
      }
      update.comment = validation.comment;
    }

    // Validate title if being updated
    if (update.title) {
      const validation = validateTitle(update.title);
      if (!validation.isValid) {
        return next(new Error(validation.error));
      }
      update.title = validation.title;
    }

    // Update timestamp
    update.updatedAt = new Date();

    next();
  });

  // Post-save middleware - Update product average rating
  schema.post('save', async function(doc) {
    const Review = mongoose.model('Review');
    const stats = await Review.aggregate([
      { $match: { productId: doc.productId, status: 'approved' } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);

    await mongoose.model('Product').findByIdAndUpdate(doc.productId, {
      averageRating: stats[0]?.averageRating || 0,
      ratingCount: stats[0]?.count || 0
    });
  });

  // Post-find middleware to populate common fields
  schema.post(/^find/, async function(result) {
    if (!result) return;

    const UserModel = mongoose.model('User');
    const ProductModel = mongoose.model('Product');
    
    const populateFields = async (item) => {
      // Check if it's a Mongoose document (has populate method)
      if (item && typeof item.populate === 'function') {
        // It's a document - use populate with array syntax (Mongoose 6+)
        await item.populate([
          { path: 'userId', select: 'username displayName avatar' },
          { path: 'productId', select: 'name slug images' },
          { path: 'helpfulBy', select: 'username' },
          { path: 'reportedBy.user', select: 'username' },
          { path: 'response.respondedBy', select: 'username' }
        ]);
      } 
      // If it's a plain object (from lean()) or we need to populate manually
      else if (item) {
        // Manual population for lean objects
        if (item.userId && typeof item.userId === 'object' && !item.userId.username) {
          const user = await UserModel.findById(item.userId)
            .select('username displayName avatar')
            .lean();
          if (user) item.userId = user;
        }
        
        if (item.productId && typeof item.productId === 'object' && !item.productId.name) {
          const product = await ProductModel.findById(item.productId)
            .select('name slug images')
            .lean();
          if (product) item.productId = product;
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