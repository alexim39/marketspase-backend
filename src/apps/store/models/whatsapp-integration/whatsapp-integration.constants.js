// Message Types
export const MESSAGE_TYPE = {
  TEMPLATE: 'template',
  QUICK_REPLY: 'quick_reply',
  AUTO_RESPONSE: 'auto_response',
  CUSTOM: 'custom'
};

// Template Status
export const TEMPLATE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING_APPROVAL: 'pending_approval',
  REJECTED: 'rejected'
};

export const TEMPLATE_STATUS_ARRAY = Object.values(TEMPLATE_STATUS);

// Common Trigger Keywords
export const COMMON_TRIGGERS = {
  GREETING: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'],
  HELP: ['help', 'support', 'assist', 'guide'],
  PRODUCT: ['product', 'item', 'goods', 'merchandise'],
  PRICE: ['price', 'cost', 'how much', 'pricing'],
  ORDER: ['order', 'buy', 'purchase', 'checkout'],
  SHIPPING: ['shipping', 'delivery', 'ship', 'deliver'],
  RETURN: ['return', 'refund', 'exchange', 'cancel'],
  CONTACT: ['contact', 'call', 'phone', 'email', 'reach'],
  HOURS: ['hours', 'open', 'close', 'time', 'schedule'],
  LOCATION: ['location', 'address', 'where', 'store'],
  PAYMENT: ['pay', 'payment', 'method', 'card', 'cash'],
  DISCOUNT: ['discount', 'promo', 'offer', 'sale', 'deal'],
  REVIEW: ['review', 'feedback', 'rating', 'rate'],
  COMPLAINT: ['complaint', 'issue', 'problem', 'wrong'],
  THANK: ['thank', 'thanks', 'appreciate', 'grateful']
};

// Default Values
export const DEFAULTS = {
  TEMPLATE_IS_ACTIVE: true,
  TEMPLATE_VARIABLES: [],
  QUICK_REPLIES: [],
  AUTO_RESPONSES: []
};

// Validation Rules
export const VALIDATION = {
  TEMPLATE_NAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 50
  },
  TEMPLATE_MESSAGE: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 1000
  },
  QUICK_REPLY: {
    MAX_LENGTH: 100
  },
  AUTO_RESPONSE_TRIGGER: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 50
  },
  AUTO_RESPONSE_MESSAGE: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 500
  },
  VARIABLE_NAME: {
    PATTERN: /^[a-zA-Z][a-zA-Z0-9]*$/,
    MAX_LENGTH: 30
  }
};

// Common Variable Placeholders
export const COMMON_VARIABLES = [
  'storeName',
  'storeLink',
  'ownerName',
  'productName',
  'productPrice',
  'orderNumber',
  'orderStatus',
  'trackingNumber',
  'deliveryDate',
  'customerName',
  'discountCode',
  'discountAmount',
  'supportPhone',
  'supportEmail',
  'businessHours',
  'storeAddress'
];

// Error Messages
export const ERROR_MESSAGES = {
  STORE_REQUIRED: 'Store ID is required',
  TEMPLATE_NAME_REQUIRED: 'Template name is required',
  TEMPLATE_MESSAGE_REQUIRED: 'Template message is required',
  TEMPLATE_NOT_FOUND: 'Template not found',
  INTEGRATION_NOT_FOUND: 'WhatsApp integration not found for this store',
  DUPLICATE_TEMPLATE_NAME: 'A template with this name already exists',
  INVALID_VARIABLE: 'Invalid variable name format',
  VARIABLE_NOT_FOUND: 'Variable not found in template',
  QUICK_REPLY_TOO_LONG: `Quick reply cannot exceed ${VALIDATION.QUICK_REPLY.MAX_LENGTH} characters`,
  AUTO_RESPONSE_TRIGGER_REQUIRED: 'Auto response trigger is required',
  AUTO_RESPONSE_MESSAGE_REQUIRED: 'Auto response message is required',
  TRIGGER_ALREADY_EXISTS: 'An auto response with this trigger already exists'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  INTEGRATION_CREATED: 'WhatsApp integration created successfully',
  INTEGRATION_UPDATED: 'WhatsApp integration updated successfully',
  INTEGRATION_DELETED: 'WhatsApp integration deleted successfully',
  TEMPLATE_ADDED: 'Template added successfully',
  TEMPLATE_UPDATED: 'Template updated successfully',
  TEMPLATE_DELETED: 'Template deleted successfully',
  QUICK_REPLY_ADDED: 'Quick reply added successfully',
  QUICK_REPLY_REMOVED: 'Quick reply removed successfully',
  AUTO_RESPONSE_ADDED: 'Auto response added successfully',
  AUTO_RESPONSE_UPDATED: 'Auto response updated successfully',
  AUTO_RESPONSE_DELETED: 'Auto response deleted successfully'
};