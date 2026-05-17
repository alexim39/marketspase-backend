import mongoose from "mongoose";
import { 
  CAMPAIGN_STATUS_ARRAY,
  THRESHOLDS,
  NOTIFICATION_TYPES 
} from "./campaign.constants.js";
import { 
  createActivityEntry, 
  createNotificationEntry,
  wasNotificationRecentlySent,
  shouldSendBudgetAlert
} from "./campaign.utils.js";

export const setupCampaignMethods = (schema) => {
  // Method to assign a promoter (used during acceptance)
  schema.methods.assignPromoter = function() {
    if (this.status !== "active") return false;

    const unitCost = Number(this.costPerClick ?? this.payoutPerPromotion ?? 0);
    const available = this.budget - this.spentBudget;
    if (available < unitCost) {
      this.status = "exhausted";
      this._justExhausted = true;
      return false;
    }

    this.totalPromotions += 1;

    this.activityLog.push(createActivityEntry(
      "Promotion Link Accepted",
      "A promoter accepted this campaign and a tracked promotion link was created."
    ));

    return true;
  };

  // Method to update campaign status
  schema.methods.updateStatus = function(newStatus, performedBy, details = "") {
    const oldStatus = this.status;
    
    if (CAMPAIGN_STATUS_ARRAY.includes(newStatus)) {
      this.status = newStatus;

      if (performedBy && mongoose.Types.ObjectId.isValid(performedBy)) {
        this.createdBy = performedBy;
      }

      const activityEntry = createActivityEntry(
        "Status Changed",
        `Status changed from ${oldStatus} to ${newStatus}. ${details}`,
        performedBy
      );

      this.activityLog.push(activityEntry);
    }

    return this;
  };

  // Notification-related methods
  schema.methods.logNotification = function(notificationType, sentTo, metadata = {}) {
    this.notificationLog.push(createNotificationEntry(notificationType, sentTo, metadata));
    
    this.activityLog.push(createActivityEntry(
      "Notification Sent",
      `${notificationType} notification sent to user`
    ));
    
    return this;
  };

  schema.methods.wasNotificationRecentlySent = function(notificationType, userId, hours = THRESHOLDS.RECENT_NOTIFICATION_HOURS) {
    return wasNotificationRecentlySent(this.notificationLog, notificationType, userId, hours);
  };

  schema.methods.shouldSendBudgetAlert = function(thresholdPercentage = THRESHOLDS.BUDGET_ALERT_PERCENTAGE) {
    return shouldSendBudgetAlert(
      this.budgetUtilization,
      this.budgetAlerts.lastAlertPercentage,
      this.status,
      thresholdPercentage
    );
  };

  schema.methods.recordBudgetAlert = function(percentage) {
    this.budgetAlerts.sentAt.push(new Date());
    this.budgetAlerts.lastAlertPercentage = percentage;
    return this;
  };

  schema.methods.getPerformanceSummary = function() {
    return {
      totalPromotions: this.totalPromotions,
      spentBudget: this.spentBudget,
      remainingBudget: this.remainingBudget,
      progress: this.progress,
      budgetUtilization: this.budgetUtilization,
      estimatedViews: this.estimatedViews,
      conversionRate: this.conversionRate,
      budgetEfficiency: this.budgetEfficiency
    };
  };

  // Method to check if campaign matches user targeting
  schema.methods.matchesTargeting = function(user) {
    if (!this.enableTarget) return true;

    // Check age target
    if (this.ageTarget !== 'all' && user.personalInfo?.dob) {
      const age = calculateAge(user.personalInfo.dob);
      if (!matchesAgeTarget(age, this.ageTarget)) return false;
    }

    // Check rating
    if (user.rating < this.minRating) return false;

    // Check location (simplified - you might want more sophisticated matching)
    if (this.targetLocations?.length > 0 && user.personalInfo?.address?.country) {
      const userCountry = user.personalInfo.address.country;
      return this.targetLocations.some(loc => 
        loc.name.toLowerCase().includes(userCountry.toLowerCase())
      );
    }

    return true;
  };
};

// Helper functions for targeting
const calculateAge = (dob) => {
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
};

const matchesAgeTarget = (age, target) => {
  switch(target) {
    case 'young': return age >= 18 && age <= 25;
    case 'middle': return age >= 26 && age <= 40;
    case 'advanced': return age > 40;
    default: return true;
  }
};
