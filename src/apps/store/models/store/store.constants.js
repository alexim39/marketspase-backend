// Store Verification Tiers
export const VERIFICATION_TIER = {
  BASIC: 'basic',
  PREMIUM: 'premium'
};

export const VERIFICATION_TIER_ARRAY = Object.values(VERIFICATION_TIER);

// Store Categories (common e-commerce categories)
export const STORE_CATEGORY = {
  FASHION: 'fashion',
  FOOD: 'food',
  TECH: 'tech',
  HEALTH: 'health',
  TRAVEL: 'travel',
  EDUCATION: 'education',
  ENTERTAINMENT: 'entertainment',
  BUSINESS: 'business',
  LIFESTYLE: 'lifestyle',
  AUTOMOTIVE: 'automotive',
  SPORTS: 'sports',
  REALESTATE: 'realestate',
  EVENTS: 'events',
  GAMING: 'gaming',
  NONPROFIT: 'nonprofit',
  POLITICS: 'politics',
  RELIGION: 'religion',
  PARENTING: 'parenting',
  PETS: 'pets',
  ART: 'art',
  HOME: 'home',
  SCIENCE: 'science',
  JOBS: 'jobs',
  FINANCE: 'finance',
  INSURANCE: 'insurance',
  LEGAL: 'legal',
  MUSIC: 'music',
  MOVIES: 'movies',
  TELECOM: 'telecom',
  UTILITIES: 'utilities',
  CRYPTO: 'crypto',
  ENVIRONMENT: 'environment',
  AGRICULTURE: 'agriculture',
  SHOPPING: 'shopping',
  ALCOHOL: 'alcohol',
  BEAUTY: 'beauty',
  FASHIONMEN: 'fashionmen',
  FASHIONWOMEN: 'fashionwomen',
  KIDS: 'kids',
  BOOKS: 'books',
  LUXURY: 'luxury',
  ARTS: 'arts',
  SOFTWARE: 'software',
  HARDWARE: 'hardware',
  PRODUCTIVITY: 'productivity',
  DATING: 'dating',
  TRANSPORT: 'transport',
  STARTUPS: 'startups',
  INFLUENCERS: 'influencers',
  REVIEWS: 'reviews',
  OTHER: 'other'
};

export const STORE_CATEGORY_ARRAY = Object.values(STORE_CATEGORY);

// Default Values
export const DEFAULTS = {
  IS_VERIFIED: false,
  IS_DEFAULT_STORE: false,
  IS_ACTIVE: true,
  IS_DELETED: false,
  VERIFICATION_TIER: VERIFICATION_TIER.BASIC,
  ANALYTICS: {
    totalViews: 0,
    totalSales: 0,
    conversionRate: 0,
    promoterTraffic: 0
  },
  ACTIVE_CAMPAIGNS: [],
  STORE_PRODUCTS: [],
  WHATSAPP_TEMPLATES: []
};

// Error Messages
export const ERROR_MESSAGES = {
  OWNER_REQUIRED: 'Store owner is required',
  NAME_REQUIRED: 'Store name is required',
  STORE_LINK_REQUIRED: 'Store link is required',
  STORE_LINK_UNIQUE: 'Store link must be unique',
  STORE_LINK_INVALID: 'Store link can only contain letters, numbers, hyphens and underscores',
  STORE_NOT_FOUND: 'Store not found',
  UNAUTHORIZED_ACCESS: 'You are not authorized to access this store',
  DEFAULT_STORE_EXISTS: 'A default store already exists for this user',
  WHATSAPP_NUMBER_INVALID: 'Invalid WhatsApp number format',
  CANNOT_DELETE_DEFAULT_STORE: 'Cannot delete default store. Set another store as default first'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  STORE_CREATED: 'Store created successfully',
  STORE_UPDATED: 'Store updated successfully',
  STORE_DELETED: 'Store deleted successfully',
  STORE_RESTORED: 'Store restored successfully',
  DEFAULT_STORE_SET: 'Default store updated successfully'
};

// Validation Rules
export const VALIDATION = {
  STORE_LINK: {
    PATTERN: /^[a-zA-Z0-9_-]+$/,
    MIN_LENGTH: 3,
    MAX_LENGTH: 50
  },
  NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 100
  },
  DESCRIPTION: {
    MAX_LENGTH: 1000
  },
  WHATSAPP_NUMBER: {
    PATTERN: /^\+?[1-9]\d{1,14}$/ // E.164 format
  }
};