import { extractHashtags, extractMentions } from "./feed.utils.js";

export const setupFeedMiddleware = (schema) => {
  // Pre-save middleware
  schema.pre('save', function(next) {
    this.updatedAt = new Date();

    // Update hashtags from content
    if (this.isModified('content')) {
      const hashtags = extractHashtags(this.content);
      this.hashtags = hashtags;
    }

    // Extract mentions from content
    if (this.isModified('content')) {
      const mentions = extractMentions(this.content);
      this.mentions = mentions;
    }

    // Set default values for earnings
    if (this.type === 'earnings' && !this.earnings) {
      this.earnings = { amount: 0, currency: 'NGN' };
    }

    // Set default values for tip
    if (this.type === 'tip' && !this.tip) {
      this.tip = { views: 0 };
    }

    // Ensure reach object exists
    if (!this.reach) {
      this.reach = { impressions: 0, uniqueViews: [] };
    }

    next();
  });

  // Pre-findOneAndUpdate middleware
  schema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    update.updatedAt = new Date();

    // Update hashtags if content is modified
    if (update.content) {
      const hashtags = extractHashtags(update.content);
      update.hashtags = hashtags;
    }

    next();
  });

  // Post-save middleware
  schema.post('save', function(doc) {
    // Could emit event for real-time updates
    // emit('feed.post.created', doc);
  });

  // Post-find middleware to populate mentions
  schema.post(/^find/, async function(docs) {
    if (!docs) return;

    const populateMentions = async (doc) => {
      if (doc.mentions && doc.mentions.length > 0) {
        const UserModel = mongoose.model('User');
        for (const mention of doc.mentions) {
          if (mention.username && !mention.user) {
            const user = await UserModel.findOne({ username: mention.username });
            if (user) {
              mention.user = user._id;
            }
          }
        }
      }
    };

    if (Array.isArray(docs)) {
      await Promise.all(docs.map(populateMentions));
    } else {
      await populateMentions(docs);
    }
  });
};