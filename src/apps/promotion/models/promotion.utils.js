/**
 * Utility function to add timeout to promises
 * @param {Promise} p - The promise to add timeout to
 * @param {number} ms - Timeout in milliseconds
 * @param {string} label - Label for the operation
 * @returns {Promise} - Promise with timeout
 */
export const withTimeout = (p, ms, label = "operation") =>
  Promise.race([
    p,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);

/**
 * Calculate days since a given date
 * @param {Date} date - The date to calculate from
 * @returns {number|null} - Days since date or null if date is invalid
 */
export const daysSince = (date) => {
  if (!date) return null;
  return Math.ceil((Date.now() - new Date(date)) / 86400000);
};

/**
 * Check if hours since a date are within a range
 * @param {Date} date - The date to check
 * @param {number} startHours - Start of range in hours
 * @param {number} endHours - End of range in hours
 * @returns {boolean} - True if within range
 */
export const isWithinHoursRange = (date, startHours, endHours) => {
  if (!date) return false;
  const hoursSince = (Date.now() - new Date(date)) / 3600000;
  return hoursSince >= startHours && hoursSince <= endHours;
};

/**
 * Generate activity log entry
 * @param {string} action - The action performed
 * @param {string} details - Additional details
 * @param {ObjectId} performedBy - User who performed the action
 * @returns {Object} - Activity log entry
 */
export const createActivityEntry = (action, details = '', performedBy = null) => ({
  action,
  details,
  timestamp: new Date(),
  performedBy
});

/**
 * Check if proof views are valid for submission
 * @param {number} views - Number of proof views
 * @param {string} status - Current promotion status
 * @param {number} minViews - Minimum required views
 * @returns {boolean} - True if valid
 */
export const isValidProofViews = (views, status, minViews) => {
  if (status !== PROMOTION_STATUS.SUBMITTED && status !== PROMOTION_STATUS.VALIDATED) {
    return true;
  }
  return Number.isFinite(views) && views >= minViews;
};