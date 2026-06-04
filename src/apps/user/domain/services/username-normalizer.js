export const normalizeUsername = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

export const isValidUsernameFormat = (username) => /^[a-zA-Z0-9_]+$/.test(username);
