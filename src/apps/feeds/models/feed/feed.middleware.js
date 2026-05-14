import { calculateTrendingScore, extractHashtags, extractMentions, mergeHashtags, normalizeHashtagInput } from "./feed.utils.js";
import mongoose from "mongoose";

export const setupFeedMiddleware = (schema) => {
  // Pre-save middleware
  schema.pre('save', function(next) {
    this.updatedAt = new Date();

    // Update hashtags from content
    if (this.isModified('content')) {
      const extractedHashtags = extractHashtags(this.content);
      const existingHashtags = normalizeHashtagInput(this.hashtags);
      const challengeHashtags = this.challenge?.tag ? [{ tag: this.challenge.tag }] : [];
      this.hashtags = mergeHashtags(extractedHashtags, existingHashtags, challengeHashtags);
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

    if (!this.recommendation) {
      this.recommendation = {};
    }

    if (!this.recommendation.primaryCategory) {
      this.recommendation.primaryCategory =
        this.product?.category?.toLowerCase?.()
        || this.campaign?.category?.toLowerCase?.()
        || this.type;
    }

    const topicalTags = [
      ...(this.hashtags || []).map((entry) => entry?.tag).filter(Boolean),
      this.product?.category,
      this.campaign?.category,
      this.type
    ]
      .filter(Boolean)
      .map((value) => value.toString().trim().toLowerCase());

    this.recommendation.topicalTags = [...new Set(topicalTags)];
    this.recommendation.lastScoredAt = new Date();
    this.recommendation.engagementVelocity = (this.likes?.length || 0) + ((this.comments?.length || 0) * 1.5) + ((this.shares?.length || 0) * 1.25);
    this.trendingScore = calculateTrendingScore(this);

    next();
  });

  // Pre-findOneAndUpdate middleware
  schema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    update.updatedAt = new Date();

    // Update hashtags if content is modified
    if (update.content) {
      const challengeHashtags = update?.challenge?.tag ? [{ tag: update.challenge.tag }] : [];
      update.hashtags = mergeHashtags(extractHashtags(update.content), update.hashtags, challengeHashtags);
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
