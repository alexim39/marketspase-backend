export const PROFILE_WINDOW_DAYS = 30;
export const PROFILE_TOP_LIMIT = 4;

export const sanitizeProfileString = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
};

export const compactSocialProfiles = (profiles = {}) => {
  if (!profiles || typeof profiles !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(profiles)
      .map(([key, value]) => [key, sanitizeProfileString(value)])
      .filter(([, value]) => Boolean(value)),
  );
};

export const isSummaryProfileView = (value) => (
  ['summary', 'dashboard', 'compact'].includes(String(value || '').trim().toLowerCase())
);

export const sumStoreValues = (stores, selector) => (
  stores.reduce((total, store) => total + Number(selector(store) || 0), 0)
);
