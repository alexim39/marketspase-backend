export const setupReviewVirtuals = (schema) => {
  // Virtual for is helpful
  schema.virtual('isHelpful').get(function() {
    return this.helpfulCount > 0;
  });

  // Virtual for has response
  schema.virtual('hasResponse').get(function() {
    return !!(this.response && this.response.content);
  });

  // Virtual for has images
  schema.virtual('hasImages').get(function() {
    return this.images && this.images.length > 0;
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

  // Virtual for is approved
  schema.virtual('isApproved').get(function() {
    return this.status === 'approved';
  });

  // Virtual for is pending
  schema.virtual('isPending').get(function() {
    return this.status === 'pending';
  });

  // Virtual for is flagged
  schema.virtual('isFlagged').get(function() {
    return this.status === 'flagged';
  });

  // Virtual for helpful percentage
  schema.virtual('helpfulPercentage').get(function() {
    const total = this.helpfulCount + this.reportCount;
    if (total === 0) return 0;
    return (this.helpfulCount / total) * 100;
  });

  // Virtual for can be featured
  schema.virtual('canBeFeatured').get(function() {
    return this.status === 'approved' && this.verifiedPurchase && this.helpfulCount > 0;
  });

  // Virtual for response time (if responded)
  schema.virtual('responseTime').get(function() {
    if (!this.response || !this.response.createdAt) return null;
    
    const responseTime = new Date(this.response.createdAt) - this.createdAt;
    const hours = Math.floor(responseTime / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    }
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  });

  // Virtual for sentiment (based on rating)
  schema.virtual('sentiment').get(function() {
    if (this.rating >= 4) return 'positive';
    if (this.rating <= 2) return 'negative';
    return 'neutral';
  });
};