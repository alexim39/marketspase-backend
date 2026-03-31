import { VALIDATION } from "./promotion.constants.js";
import { daysSince } from "./promotion.utils.js";

export const setupPromotionVirtuals = (schema) => {
  schema.virtual("daysSinceSubmission").get(function () {
    return daysSince(this.submittedAt);
  });

  schema.virtual("isOverdue").get(function () {
    if (!this.submittedAt) return false;
    if (["paid", "rejected"].includes(this.status)) return false;
    return this.daysSinceSubmission > VALIDATION.OVERDUE_DAYS;
  });

  schema.virtual("needsSubmissionReminder").get(function () {
    if (this.status !== "downloaded") return false;
    if (!this.downloadedAt) return false;
    
    const hoursSinceDownload = (Date.now() - this.downloadedAt) / 3600000;
    return hoursSinceDownload >= VALIDATION.SUBMISSION_REMINDER_HOURS.START && 
           hoursSinceDownload <= VALIDATION.SUBMISSION_REMINDER_HOURS.END;
  });

  schema.virtual("canBeValidated").get(function () {
    return this.status === "submitted" && 
           this.proofViews >= VALIDATION.MIN_PROOF_VIEWS;
  });

  schema.virtual("canBePaid").get(function () {
    return this.status === "validated" && 
           !this.hasBeenPaid;
  });

  schema.virtual("timeToSubmissionDeadline").get(function () {
    if (!this.downloadedAt) return null;
    const deadlineMs = this.downloadedAt.getTime() + (VALIDATION.SUBMISSION_REMINDER_HOURS.END * 3600000);
    return Math.max(0, deadlineMs - Date.now());
  });
};