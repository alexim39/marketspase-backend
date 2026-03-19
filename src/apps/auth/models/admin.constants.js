// Admin Roles
export const ADMIN_ROLES = {
  ADMIN: 'admin',
  SUPER_ADMIN: 'super-admin'
};

export const ADMIN_ROLES_ARRAY = Object.values(ADMIN_ROLES);

// Password Validation
export const PASSWORD_VALIDATION = {
  MIN_LENGTH: 6,
  MAX_LENGTH: 128,
  SALT_ROUNDS: 10
};

// Default Values
export const DEFAULTS = {
  ROLE: ADMIN_ROLES.ADMIN,
  NAME: ''
};

// Error Messages
export const ERROR_MESSAGES = {
  EMAIL_REQUIRED: 'Email is required',
  PASSWORD_REQUIRED: 'Password is required',
  PASSWORD_MIN_LENGTH: `Password must be at least ${PASSWORD_VALIDATION.MIN_LENGTH} characters long`,
  EMAIL_INVALID: 'Please provide a valid email address',
  ADMIN_NOT_FOUND: 'Admin not found',
  INVALID_CREDENTIALS: 'Invalid email or password'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  PASSWORD_CHANGED: 'Password changed successfully',
  ADMIN_CREATED: 'Admin created successfully',
  ADMIN_UPDATED: 'Admin updated successfully',
  ADMIN_DELETED: 'Admin deleted successfully'
};

// Activity Actions (for logging)
export const ACTIVITY_ACTIONS = {
  ADMIN_CREATED: 'admin_created',
  ADMIN_UPDATED: 'admin_updated',
  ADMIN_DELETED: 'admin_deleted',
  ADMIN_LOGIN: 'admin_login',
  ADMIN_LOGOUT: 'admin_logout',
  PASSWORD_CHANGED: 'password_changed',
  ROLE_CHANGED: 'role_changed',
  PERMISSIONS_UPDATED: 'permissions_updated'
};

// Permissions (if you want to add granular permissions later)
export const PERMISSIONS = {
  MANAGE_USERS: 'manage_users',
  MANAGE_CAMPAIGNS: 'manage_campaigns',
  MANAGE_PROMOTIONS: 'manage_promotions',
  MANAGE_PAYMENTS: 'manage_payments',
  MANAGE_SETTINGS: 'manage_settings',
  VIEW_ANALYTICS: 'view_analytics',
  MANAGE_ADMINS: 'manage_admins'
};

// Role-based permissions
export const ROLE_PERMISSIONS = {
  [ADMIN_ROLES.ADMIN]: [
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_CAMPAIGNS,
    PERMISSIONS.MANAGE_PROMOTIONS,
    PERMISSIONS.MANAGE_PAYMENTS,
    PERMISSIONS.VIEW_ANALYTICS
  ],
  [ADMIN_ROLES.SUPER_ADMIN]: [
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_CAMPAIGNS,
    PERMISSIONS.MANAGE_PROMOTIONS,
    PERMISSIONS.MANAGE_PAYMENTS,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.MANAGE_ADMINS
  ]
};