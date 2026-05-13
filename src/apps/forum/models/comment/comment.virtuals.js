export const setupCommentVirtuals = (schema) => {
  // Virtual for is root comment (no parent)
  schema.virtual('isRoot').get(function() {
    return !this.parentComment;
  });

  // Virtual for excerpt (short version of content)
  schema.virtual('excerpt').get(function() {
    if (!this.content) return '';
    return this.content.length > 100 
      ? this.content.substring(0, 100) + '...' 
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

  // Virtual for edit count
  schema.virtual('editCount').get(function() {
    return this.editHistory?.length || 0;
  });

  // Virtual for has mentions
  schema.virtual('hasMentions').get(function() {
    return this.mentions && this.mentions.length > 0;
  });

  // Virtual for has hashtags
  schema.virtual('hasHashtags').get(function() {
    return this.hashtags && this.hashtags.length > 0;
  });

  // Virtual for is editable (within 24 hours and not deleted)
  schema.virtual('isEditable').get(function() {
    if (this.isDeleted) return false;
    const hoursSinceCreation = (new Date() - this.createdAt) / (1000 * 60 * 60);
    return hoursSinceCreation < 24;
  });

  // Virtual for is deletable (own comment or admin)
  schema.virtual('isDeletable').get(function() {
    return !this.isDeleted;
  });

  // Virtual for depth in nested replies
  schema.virtual('depth').get(function() {
    let depth = 0;
    let currentId = this.parentComment;
    
    // This would need to be calculated recursively in practice
    // This is a simplified version
    return depth;
  });
};
