export const setupTestimonialVirtuals = (schema) => {
  // Virtual for total reactions
  schema.virtual('totalReactions').get(function() {
    return (this.likes || 0) + (this.dislikes || 0);
  });

  // Virtual for approval rate (likes / total reactions)
  schema.virtual('approvalRate').get(function() {
    const total = this.totalReactions;
    if (total === 0) return 0;
    return ((this.likes || 0) / total) * 100;
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

  // Virtual for is rejected
  schema.virtual('isRejected').get(function() {
    return this.status === 'rejected';
  });

  // Virtual for excerpt (short version of message)
  schema.virtual('excerpt').get(function() {
    if (!this.message) return '';
    return this.message.length > 100 
      ? this.message.substring(0, 100) + '...' 
      : this.message;
  });

  // Virtual for sentiment (positive/negative/neutral)
  schema.virtual('sentiment').get(function() {
    if (this.rating >= 4) return 'positive';
    if (this.rating <= 2) return 'negative';
    return 'neutral';
  });

  // Virtual for can be featured
  schema.virtual('canBeFeatured').get(function() {
    return this.status === 'approved' && !this.isDeleted;
  });
};