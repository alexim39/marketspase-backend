export const setupThreadVirtuals = (schema) => {
  // Virtual for comments
  schema.virtual('comments', {
    ref: 'Forumcomment',
    localField: '_id',
    foreignField: 'thread',
    options: { sort: { createdAt: -1 } }
  });

  // Virtual for recent comments (last 5)
  schema.virtual('recentComments', {
    ref: 'Forumcomment',
    localField: '_id',
    foreignField: 'thread',
    options: { 
      sort: { createdAt: -1 },
      limit: 5,
      match: { isDeleted: false }
    }
  });

  // Virtual for comment count
  schema.virtual('totalComments').get(function() {
    return this.commentCount || 0;
  });

  // Virtual for excerpt (short version of content)
  schema.virtual('excerpt').get(function() {
    if (!this.content) return '';
    return this.content.length > 200 
      ? this.content.substring(0, 200) + '...' 
      : this.content;
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

  // Virtual for last activity time ago
  schema.virtual('lastActivityTimeAgo').get(function() {
    if (!this.lastActivityAt) return 'No activity';
    
    const seconds = Math.floor((new Date() - this.lastActivityAt) / 1000);
    
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

  // Virtual for engagement rate
  schema.virtual('engagementRate').get(function() {
    const total = (this.likeCount || 0) + (this.commentCount || 0);
    if (this.viewCount === 0) return 0;
    return (total / this.viewCount) * 100;
  });

  // Virtual for has media
  schema.virtual('hasMedia').get(function() {
    return Boolean(
      (Array.isArray(this.mediaItems) && this.mediaItems.length > 0) ||
      (this.media && this.media.url)
    );
  });

  schema.virtual('mediaCount').get(function() {
    if (Array.isArray(this.mediaItems) && this.mediaItems.length > 0) {
      return this.mediaItems.length;
    }

    return this.media?.url ? 1 : 0;
  });

  schema.virtual('isCarousel').get(function() {
    return this.mediaCount > 1;
  });

  // Virtual for has tags
  schema.virtual('hasTags').get(function() {
    return this.tags && this.tags.length > 0;
  });

  // Virtual for is active (not locked or deleted)
  schema.virtual('isActive').get(function() {
    return !this.isLocked && !this.isDeleted;
  });

  // Virtual for can comment (FIXED: renamed to isCommentable to avoid conflict)
  schema.virtual('isCommentable').get(function() {
    return !this.isLocked && !this.isDeleted && this.status === 'active';
  });

  // Virtual for is trending
  schema.virtual('isTrending').get(function() {
    return this.trendingScore > 10; // Threshold can be adjusted
  });

  // Virtual for url slug
  schema.virtual('url').get(function() {
    const slug = this.slug || this.title.toLowerCase().replace(/\s+/g, '-');
    return `/forum/thread/${slug || this._id}`;
  });
};
