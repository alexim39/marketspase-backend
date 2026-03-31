export const setupPromotionVirtuals = (schema) => {
  schema.virtual('totalEarnings').get(function() {
    return this.earnings || 0;
  });

  schema.virtual('isExpired').get(function() {
    if (!this.endDate) return false;
    return new Date() > this.endDate;
  });

  schema.virtual('daysActive').get(function() {
    const start = this.startDate || this.createdAt;
    const diff = new Date() - new Date(start);
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  });
};