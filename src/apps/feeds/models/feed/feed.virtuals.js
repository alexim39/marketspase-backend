export const setupFeedVirtuals = (schema) => {
  // Virtual for like count
  schema.virtual('likeCount').get(function() {
    return this.likes?.length || 0;
  });

  // Virtual for comment count
  schema.virtual('commentCount').get(function() {
    return this.comments?.length || 0;
  });

  // Virtual for save count
  schema.virtual('saveCount').get(function() {
    return this.savedBy?.length || 0;
  });

  // Virtual for share count
  schema.virtual('shareCount').get(function() {
    return this.shares?.length || 0;
  });

  // Virtual for unique view count
  schema.virtual('uniqueViewCount').get(function() {
    return this.reach?.uniqueViews?.length || 0;
  });

  // Virtual for engagement rate
  schema.virtual('engagementRate').get(function() {
    const total = this.likeCount + this.commentCount + this.shareCount;
    if (this.reach?.impressions === 0) return 0;
    return (total / (this.reach?.impressions || 1)) * 100;
  });

  // Virtual for time ago
  schema.virtual('timeAgo').get(function() {
    const seconds = Math.floor((new Date() - this.createdAt) / 1000);
    
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
      }
    }
    
    return 'just now';
  });

  // Virtual for is trending
  schema.virtual('isTrending').get(function() {
    return this.trendingScore > 10; // Threshold can be adjusted
  });

  // Virtual for has media
  schema.virtual('hasMedia').get(function() {
    return this.media && this.media.length > 0;
  });

  // Virtual for has hashtags
  schema.virtual('hasHashtags').get(function() {
    return this.hashtags && this.hashtags.length > 0;
  });

  // Virtual for has mentions
  schema.virtual('hasMentions').get(function() {
    return this.mentions && this.mentions.length > 0;
  });

  // Virtual for is editable (within 24 hours)
  schema.virtual('isEditable').get(function() {
    const hoursSinceCreation = (new Date() - this.createdAt) / (1000 * 60 * 60);
    return hoursSinceCreation < 24 && this.status === 'published';
  });
};