export const TARGET_AUDIENCE = {
  ALL: 'ALL',
  NEW_USERS: 'NEW_USERS',
  EXISTING_USERS: 'EXISTING_USERS',
  SPECIFIC_GROUP: 'SPECIFIC_GROUP',
};

export const resolveBannerAudienceScope = ({ userId, isNewUser = false, groups = [] } = {}) => {
  const audiences = [TARGET_AUDIENCE.ALL];

  if (!userId) {
    return {
      audiences,
      groups: [],
    };
  }

  audiences.push(isNewUser ? TARGET_AUDIENCE.NEW_USERS : TARGET_AUDIENCE.EXISTING_USERS);

  return {
    audiences,
    groups: Array.isArray(groups) ? groups.filter(Boolean) : [],
  };
};
