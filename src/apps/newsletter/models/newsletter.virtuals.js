export const setupNewsletterVirtuals = (schema) => {
  // Virtual for total recipients
  schema.virtual('totalRecipients').get(function() {
    if (this.recipientType === 'external') {
      return this.externalEmails ? this.externalEmails.length : 0;
    }
    return this.actualRecipients || this.estimatedRecipients;
  });

  // Virtual for engagement rate
  schema.virtual('engagementRate').get(function() {
    if (this.totalRecipients === 0) return 0;
    return (this.uniqueOpens / this.totalRecipients) * 100;
  });

  // Virtual for conversion rate (clicks from opens)
  schema.virtual('conversionRate').get(function() {
    if (this.uniqueOpens === 0) return 0;
    return (this.uniqueClicks / this.uniqueOpens) * 100;
  });

  // Virtual for version count
  schema.virtual('versionCount').get(function() {
    return this.contentVersions?.length || 0;
  });

  // Virtual for time ago (since sent)
  schema.virtual('sentTimeAgo').get(function() {
    if (!this.sentDate) return 'Not sent';
    
    const seconds = Math.floor((new Date() - this.sentDate) / 1000);
    
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

  // Virtual for is scheduled
  schema.virtual('isScheduled').get(function() {
    return this.status === 'scheduled' && this.scheduledDate > new Date();
  });

  // Virtual for is ready to send
  schema.virtual('isReadyToSend').get(function() {
    if (this.status !== 'draft' && this.status !== 'scheduled') return false;
    if (this.recipientType === 'external' && (!this.externalEmails || this.externalEmails.length === 0)) return false;
    return true;
  });

  // Virtual for delivery summary
  schema.virtual('deliverySummary').get(function() {
    if (!this.deliveryStatus || this.deliveryStatus.length === 0) {
      return {
        sent: 0,
        delivered: 0,
        bounced: 0,
        complained: 0,
        failed: 0
      };
    }

    return this.deliveryStatus.reduce((acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, {});
  });

  // Virtual for popular links
  schema.virtual('popularLinks').get(function() {
    const linkCounts = {};
    
    this.engagement?.forEach(eng => {
      eng.clickedLinks?.forEach(link => {
        linkCounts[link.url] = (linkCounts[link.url] || 0) + link.clickCount;
      });
    });
    
    return Object.entries(linkCounts)
      .map(([url, count]) => ({ url, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  });
};