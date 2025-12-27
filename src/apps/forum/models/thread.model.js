
import mongoose from 'mongoose';

/* Media Subschema (optional) */
const mediaSubSchema = new mongoose.Schema(
  {
    url: { type: String, required: false, trim: true },
    type: { type: String, enum: ['image', 'video', 'audio'], required: false },
    filename: { type: String, required: false, trim: true },
    originalName: { type: String, required: false, trim: true },
    size: { type: Number, required: false, min: 0 },
  },
  { _id: false }
);

/* Thread Schema */
const threadSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Thread title is required"],
      maxlength: [200, "Title cannot exceed 200 characters"],
      trim: true
    },
    content: {
      type: String,
      required: [true, "Thread content is required"],
      maxlength: [5000, "Content cannot exceed 5000 characters"]
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: function (tags) {
          return tags.length <= 10; // keep <=10; see note below for controller alignment
        },
        message: "Cannot add more than 10 tags"
      }
    },
    // Make media optional
    media: {
      type: mediaSubSchema,
      required: false,
      default: null
    },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    isPinned: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: false },
    category: {
      type: String,
      enum: [
        'announcements',
        'questions',
        'how-to',
        'promotions',
        'success-stories',
        'feedback',
        'marketers',
        'promoters',
        'conversion',
        'payouts',
        'bugs',
        'discussion'
      ],
      default: 'discussion'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

/* Thread Virtuals */
threadSchema.virtual('comments', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'thread'
});

/* Indexes */
threadSchema.index({ title: 'text', content: 'text' });
threadSchema.index({ author: 1, createdAt: -1 });

/* Middleware */
// Ensure commentCount never drops below 0
threadSchema.pre('save', function (next) {
  if (this.isModified('commentCount')) {
    this.commentCount = Math.max(0, this.commentCount);
  }
  next();
});

// Cascade delete comments when thread is deleted
threadSchema.pre('deleteOne', { document: true }, async function (next) {
  await this.model('Comment').deleteMany({ thread: this._id });
  next();
});

/* Models */
export const ThreadModel = mongoose.model('Thread', threadSchema);
