import { VALIDATION } from "./store.constants.js";

/**
 * Generate store link from store name
 * @param {string} name - Store name
 * @returns {string} - URL-friendly store link
 */
export const generateStoreLink = (name) => {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-')       // Replace multiple hyphens with single
    .substring(0, VALIDATION.STORE_LINK.MAX_LENGTH);
};

/**
 * Validate store link
 * @param {string} storeLink - Store link to validate
 * @returns {Object} - Validation result
 */
export const validateStoreLink = (storeLink) => {
  if (!storeLink || storeLink.trim().length === 0) {
    return {
      isValid: false,
      error: 'Store link is required'
    };
  }

  const trimmedLink = storeLink.trim();
  
  if (trimmedLink.length < VALIDATION.STORE_LINK.MIN_LENGTH) {
    return {
      isValid: false,
      error: `Store link must be at least ${VALIDATION.STORE_LINK.MIN_LENGTH} characters`
    };
  }

  if (trimmedLink.length > VALIDATION.STORE_LINK.MAX_LENGTH) {
    return {
      isValid: false,
      error: `Store link cannot exceed ${VALIDATION.STORE_LINK.MAX_LENGTH} characters`
    };
  }

  if (!VALIDATION.STORE_LINK.PATTERN.test(trimmedLink)) {
    return {
      isValid: false,
      error: 'Store link can only contain letters, numbers, hyphens and underscores'
    };
  }

  return {
    isValid: true,
    storeLink: trimmedLink
  };
};

/**
 * Validate store name
 * @param {string} name - Store name
 * @returns {Object} - Validation result
 */
export const validateStoreName = (name) => {
  if (!name || name.trim().length === 0) {
    return {
      isValid: false,
      error: 'Store name is required'
    };
  }

  const trimmedName = name.trim();
  
  if (trimmedName.length < VALIDATION.NAME.MIN_LENGTH) {
    return {
      isValid: false,
      error: `Store name must be at least ${VALIDATION.NAME.MIN_LENGTH} characters`
    };
  }

  if (trimmedName.length > VALIDATION.NAME.MAX_LENGTH) {
    return {
      isValid: false,
      error: `Store name cannot exceed ${VALIDATION.NAME.MAX_LENGTH} characters`
    };
  }

  return {
    isValid: true,
    name: trimmedName
  };
};

/**
 * Validate WhatsApp number
 * @param {string} number - WhatsApp number
 * @returns {Object} - Validation result
 */
export const validateWhatsAppNumber = (number) => {
  if (!number) {
    return { isValid: true, number: null };
  }

  const trimmedNumber = number.trim();
  
  if (!VALIDATION.WHATSAPP_NUMBER.PATTERN.test(trimmedNumber)) {
    return {
      isValid: false,
      error: 'Invalid WhatsApp number format. Use E.164 format (e.g., +2348012345678)'
    };
  }

  return {
    isValid: true,
    number: trimmedNumber
  };
};

/**
 * Format store for response
 * @param {Object} store - Store document
 * @param {boolean} includeSensitive - Include sensitive data
 * @returns {Object} - Formatted store
 */
export const formatStoreResponse = (store, includeSensitive = false) => {
  const storeObj = store.toObject ? store.toObject() : store;
  
  const formatted = {
    id: storeObj._id,
    owner: storeObj.owner,
    name: storeObj.name,
    description: storeObj.description,
    logo: storeObj.logo,
    category: storeObj.category,
    storeLink: storeObj.storeLink,
    isVerified: storeObj.isVerified,
    verificationTier: storeObj.verificationTier,
    isDefaultStore: storeObj.isDefaultStore,
    isActive: storeObj.isActive,
    address: storeObj.address,
    analytics: storeObj.analytics || {
      totalViews: 0,
      totalSales: 0,
      conversionRate: 0,
      promoterTraffic: 0
    },
    createdAt: storeObj.createdAt,
    updatedAt: storeObj.updatedAt
  };

  // Include optional fields if they exist
  if (storeObj.whatsappNumber && includeSensitive) {
    formatted.whatsappNumber = storeObj.whatsappNumber;
  }

  if (storeObj.whatsappTemplates && includeSensitive) {
    formatted.whatsappTemplates = storeObj.whatsappTemplates;
  }

  // Add counts
  formatted.productCount = storeObj.storeProducts?.length || 0;
  formatted.campaignCount = storeObj.activeCampaigns?.length || 0;

  return formatted;
};

/**
 * Calculate store performance score
 * @param {Object} analytics - Store analytics
 * @returns {number} - Performance score (0-100)
 */
export const calculatePerformanceScore = (analytics) => {
  if (!analytics) return 0;

  const viewsScore = Math.min(analytics.totalViews / 1000 * 10, 20); // Max 20 points
  const salesScore = Math.min(analytics.totalSales * 2, 30); // Max 30 points
  const conversionScore = analytics.conversionRate * 5; // Max 25 points (5% = 25)
  const promoterScore = Math.min(analytics.promoterTraffic / 100 * 5, 25); // Max 25 points

  return Math.min(viewsScore + salesScore + conversionScore + promoterScore, 100);
};

/**
 * Check if store is eligible for premium verification
 * @param {Object} store - Store object
 * @returns {boolean} - Eligibility status
 */
export const isEligibleForPremiumVerification = (store) => {
  const analytics = store.analytics || {};
  return (
    analytics.totalSales >= 100 && // At least 100 sales
    analytics.conversionRate >= 3 && // At least 3% conversion rate
    analytics.totalViews >= 5000 // At least 5000 views
  );
};