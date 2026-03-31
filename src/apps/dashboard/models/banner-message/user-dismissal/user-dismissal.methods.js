export const setupUserDismissalMethods = (schema) => {
  // Check if user has dismissed a specific banner
  schema.methods.hasDismissed = function(bannerId) {
    return this.dismissedNotifications.some(
      id => id.toString() === bannerId.toString()
    );
  };

  // Add dismissed banner
  schema.methods.addDismissal = async function(bannerId) {
    if (!this.hasDismissed(bannerId)) {
      this.dismissedNotifications.push(bannerId);
      this.dismissedAt.set(bannerId.toString(), new Date());
      this.dismissalCount += 1;
      this.lastDismissedAt = new Date();
      await this.save();
    }
    return this;
  };

  // Remove dismissed banner (if needed for re-showing)
  schema.methods.removeDismissal = async function(bannerId) {
    this.dismissedNotifications = this.dismissedNotifications.filter(
      id => id.toString() !== bannerId.toString()
    );
    this.dismissedAt.delete(bannerId.toString());
    await this.save();
    return this;
  };

  // Clear all dismissals
  schema.methods.clearAllDismissals = async function() {
    this.dismissedNotifications = [];
    this.dismissedAt.clear();
    this.dismissalCount = 0;
    await this.save();
    return this;
  };

  // Get dismissal count for a specific period
  schema.methods.getDismissalCountForPeriod = function(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    let count = 0;
    for (const [bannerId, date] of this.dismissedAt) {
      if (date > cutoffDate) {
        count++;
      }
    }
    return count;
  };
};