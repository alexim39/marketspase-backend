const coerceLegacyBooleanFilter = (value) => (
  value === 'true' ? true : value === 'false' ? false : value
);

export const ADMIN_USER_LIST_ROLES = ['marketer', 'promoter', 'admin'];

export const isValidAdminUserListRole = (role) => ADMIN_USER_LIST_ROLES.includes(role);

export const buildAdminUserListQuery = ({
  search = '',
  role = undefined,
  isActive = undefined,
  isVerified = undefined,
} = {}) => {
  const query = { isDeleted: false };

  if (role) {
    query.role = role;
  }

  if (isActive !== undefined) {
    query.isActive = coerceLegacyBooleanFilter(isActive);
  }

  if (isVerified !== undefined) {
    query.isVerified = coerceLegacyBooleanFilter(isVerified);
  }

  if (search && String(search).trim()) {
    const searchRegex = new RegExp(String(search).trim(), 'i');
    query.$or = [
      { username: searchRegex },
      { email: searchRegex },
      { displayName: searchRegex },
      { 'personalInfo.phone': searchRegex },
    ];
  }

  return query;
};

export const buildAdminUsersByRoleListQuery = ({
  role,
  search = '',
  isActive = undefined,
  isVerified = undefined,
} = {}) => {
  const query = {
    isDeleted: false,
    role,
  };

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  if (isVerified !== undefined) {
    query.isVerified = isVerified === 'true';
  }

  if (search && String(search).trim()) {
    const searchRegex = new RegExp(String(search).trim(), 'i');
    query.$or = [
      { username: searchRegex },
      { email: searchRegex },
      { displayName: searchRegex },
    ];
  }

  return query;
};

export const buildAdminUserListSort = (sort = '-createdAt') => {
  const sortValue = String(sort || '-createdAt');
  const sortObj = {};

  if (sortValue.startsWith('-')) {
    sortObj[sortValue.substring(1)] = -1;
  } else {
    sortObj[sortValue] = 1;
  }

  return sortObj;
};

export const buildAdminUserListProjection = () => ({
  password: 0,
  notificationSettings: 0,
  deviceTokens: 0,
  sseConnections: 0,
  activityLog: 0,
  'wallets.marketer.transactions': 0,
  'wallets.promoter.transactions': 0,
});

export const buildAdminUserListPagination = ({ page = 1, limit = 50 } = {}) => {
  const pageNum = Number.parseInt(page, 10);
  const limitNum = Math.min(Number.parseInt(limit, 10), 200);

  return {
    pageNum,
    limitNum,
    skip: (pageNum - 1) * limitNum,
  };
};

export const formatAdminUserRoleLabel = (role) => (
  `${role.charAt(0).toUpperCase()}${role.slice(1)}`
);
