import { calculateRate } from "./newsletter.utils.js";
import { ERROR_MESSAGES } from "./newsletter.constants.js";

export const setupNewsletterMethods = (schema) => {
  // Track email open
  schema.methods.trackOpen = async function(email, deviceInfo = {}) {
    let engagement = this.engagement.find(e => e.email === email);
    
    if (!engagement) {
      engagement = { 
        email, 
        opened: true, 
        openedAt: new Date(), 
        openCount: 1, 
        deviceInfo,
        clickedLinks: []
      };
      this.engagement.push(engagement);
    } else {
      engagement.opened = true;
      engagement.openCount += 1;
      if (!engagement.openedAt) {
        engagement.openedAt = new Date();
      }
      engagement.deviceInfo = deviceInfo;
    }
    
    this.totalOpens += 1;
    this.uniqueOpens = this.engagement.filter(e => e.opened).length;
    this.openRate = calculateRate(this.uniqueOpens, this.totalRecipients);
    
    return this.save();
  };

  // Track link click
  schema.methods.trackClick = async function(email, url, deviceInfo = {}) {
    let engagement = this.engagement.find(e => e.email === email);
    
    if (!engagement) {
      engagement = { 
        email, 
        clicked: true, 
        clickedAt: new Date(), 
        clickCount: 1,
        clickedLinks: [{ url, clickedAt: new Date(), clickCount: 1 }],
        deviceInfo,
        opened: false
      };
      this.engagement.push(engagement);
    } else {
      engagement.clicked = true;
      engagement.clickCount += 1;
      if (!engagement.clickedAt) {
        engagement.clickedAt = new Date();
      }
      engagement.deviceInfo = deviceInfo;
      
      // Track specific link click
      const link = engagement.clickedLinks.find(l => l.url === url);
      if (link) {
        link.clickCount += 1;
        link.clickedAt = new Date();
      } else {
        engagement.clickedLinks.push({ url, clickedAt: new Date(), clickCount: 1 });
      }
    }
    
    this.totalClicks += 1;
    this.uniqueClicks = this.engagement.filter(e => e.clicked).length;
    this.clickRate = calculateRate(this.uniqueClicks, this.totalRecipients);
    
    return this.save();
  };

  // Update delivery status
  schema.methods.updateDeliveryStatus = async function(email, status, additionalData = {}) {
    let delivery = this.deliveryStatus.find(d => d.email === email);
    
    if (!delivery) {
      delivery = { email, status, ...additionalData };
      this.deliveryStatus.push(delivery);
    } else {
      delivery.status = status;
      Object.assign(delivery, additionalData);
    }
    
    // Update rates
    const totalDeliveries = this.deliveryStatus.length;
    if (totalDeliveries > 0) {
      this.bounceRate = calculateRate(
        this.deliveryStatus.filter(d => d.status === 'bounced').length,
        totalDeliveries
      );
      this.complaintRate = calculateRate(
        this.deliveryStatus.filter(d => d.status === 'complained').length,
        totalDeliveries
      );
    }
    
    return this.save();
  };

  // Create new content version
  schema.methods.createContentVersion = async function(createdBy) {
    const newVersion = {
      version: this.currentVersion + 1,
      subject: this.subject,
      previewText: this.previewText,
      content: this.content,
      htmlContent: this.htmlContent,
      plainTextContent: this.plainTextContent,
      createdAt: new Date(),
      createdBy
    };
    
    this.contentVersions.push(newVersion);
    this.currentVersion += 1;
    
    return this.save();
  };

  // Restore content from version
  schema.methods.restoreContentVersion = async function(versionNumber) {
    const version = this.contentVersions.find(v => v.version === versionNumber);
    if (!version) {
      throw new Error(ERROR_MESSAGES.VERSION_NOT_FOUND(versionNumber));
    }
    
    this.subject = version.subject;
    this.previewText = version.previewText;
    this.content = version.content;
    this.htmlContent = version.htmlContent;
    this.plainTextContent = version.plainTextContent;
    
    return this.save();
  };

  // Soft delete
  schema.methods.softDelete = async function() {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.isActive = false;
    return this.save();
  };

  // Restore from soft delete
  schema.methods.restore = async function() {
    this.isDeleted = false;
    this.deletedAt = null;
    this.isActive = true;
    return this.save();
  };

  // Get performance summary
  schema.methods.getPerformanceSummary = function() {
    return {
      totalRecipients: this.totalRecipients,
      sentDate: this.sentDate,
      openRate: this.openRate,
      clickRate: this.clickRate,
      totalOpens: this.totalOpens,
      totalClicks: this.totalClicks,
      uniqueOpens: this.uniqueOpens,
      uniqueClicks: this.uniqueClicks,
      bounceRate: this.bounceRate,
      complaintRate: this.complaintRate,
      unsubscribes: this.unsubscribes,
      popularLinks: this.popularLinks,
      deliverySummary: this.deliverySummary
    };
  };

  // Cancel scheduled newsletter
  schema.methods.cancel = async function() {
    if (this.status !== 'scheduled') {
      throw new Error('Only scheduled newsletters can be cancelled');
    }
    
    this.status = 'cancelled';
    this.isActive = false;
    return this.save();
  };

  // Mark as sent
  schema.methods.markAsSent = async function(actualRecipients, messageId) {
    this.status = 'sent';
    this.sentDate = new Date();
    this.actualRecipients = actualRecipients || this.estimatedRecipients;
    if (messageId) {
      this.messageId = messageId;
    }
    return this.save();
  };
};