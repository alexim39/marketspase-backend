import mongoose from 'mongoose';


/* Comment Schema */
const commentSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: [true, "Comment content is required"],
      maxlength: [2000, "Comment cannot exceed 2000 characters"]
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    thread: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Thread',
      required: true
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment'
    },
    likeCount: {
      type: Number,
      default: 0
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);


/* Comment Virtuals */
commentSchema.virtual('replies', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parentComment'
});

/* Indexes */
commentSchema.index({ thread: 1, createdAt: -1 });
commentSchema.index({ author: 1, createdAt: -1 });

/* Models */
export const CommentModel = mongoose.model('Comment', commentSchema);