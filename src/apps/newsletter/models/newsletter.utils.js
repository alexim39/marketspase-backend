import { VALIDATION } from "./newsletter.constants.js";

/**
 * Generate HTML content from plain text
 * @param {string} content - Plain text content
 * @returns {string} - Basic HTML content
 */
export const generateHtmlContent = (content) => {
  if (!content) return '';
  
  return content
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
};

/**
 * Generate plain text content from HTML or markdown
 * @param {string} content - Content to convert
 * @returns {string} - Plain text content
 */
export const generatePlainTextContent = (content) => {
  if (!content) return '';
  
  return content
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1 ($2)')
    .replace(/<[^>]*>/g, '');
};

/**
 * Validate email
 * @param {string} email - Email to validate
 * @returns {boolean} - Is valid
 */
export const isValidEmail = (email) => {
  return VALIDATION.EMAIL.PATTERN.test(email);
};

/**
 * Calculate engagement rates
 * @param {number} unique - Unique engagements
 * @param {number} total - Total recipients
 * @returns {number} - Rate percentage
 */
export const calculateRate = (unique, total) => {
  if (total === 0) return 0;
  return (unique / total) * 100;
};

/**
 * Format newsletter for response
 * @param {Object} newsletter - Newsletter document
 * @param {boolean} includeSensitive - Include sensitive data
 * @returns {Object} - Formatted newsletter
 */
export const formatNewsletterResponse = (newsletter, includeSensitive = false) => {
  const newsletterObj = newsletter.toObject ? newsletter.toObject() : newsletter;
  
  const formatted = {
    id: newsletterObj._id,
    title: newsletterObj.title,
    subject: newsletterObj.subject,
    previewText: newsletterObj.previewText,
    content: newsletterObj.content,
    htmlContent: newsletterObj.htmlContent,
    recipientType: newsletterObj.recipientType,
    status: newsletterObj.status,
    sendOption: newsletterObj.sendOption,
    scheduledDate: newsletterObj.scheduledDate,
    sentDate: newsletterObj.sentDate,
    createdAt: newsletterObj.createdAt,
    updatedAt: newsletterObj.updatedAt,
    
    // Metrics
    totalRecipients: newsletterObj.actualRecipients || newsletterObj.estimatedRecipients,
    openRate: newsletterObj.openRate,
    clickRate: newsletterObj.clickRate,
    totalOpens: newsletterObj.totalOpens,
    totalClicks: newsletterObj.totalClicks,
    uniqueOpens: newsletterObj.uniqueOpens,
    uniqueClicks: newsletterObj.uniqueClicks,
    
    // Metadata
    tags: newsletterObj.tags,
    campaignId: newsletterObj.campaignId,
    createdBy: newsletterObj.createdBy
  };

  // Include sensitive data only when authorized
  if (includeSensitive) {
    formatted.externalEmails = newsletterObj.externalEmails;
    formatted.engagement = newsletterObj.engagement;
    formatted.deliveryStatus = newsletterObj.deliveryStatus;
    formatted.contentVersions = newsletterObj.contentVersions;
  }

  return formatted;
};

/**
 * Get time ago string
 * @param {Date} date - Date to compare
 * @returns {string} - Time ago string
 */
export const getTimeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
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
};