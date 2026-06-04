export const normalizeDisplayName = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

export const isValidDisplayNameFormat = (displayName) => /^[a-zA-Z0-9\s\-_]+$/.test(displayName);

export const validateDisplayName = (value) => {
  const displayName = normalizeDisplayName(value);

  if (!displayName) {
    return {
      error: {
        statusCode: 400,
        body: {
          success: false,
          message: 'Display name is required',
        },
      },
    };
  }

  if (displayName.length < 2 || displayName.length > 50) {
    return {
      error: {
        statusCode: 400,
        body: {
          success: false,
          message: 'Display name must be between 2 and 50 characters',
        },
      },
    };
  }

  if (!isValidDisplayNameFormat(displayName)) {
    return {
      error: {
        statusCode: 400,
        body: {
          success: false,
          message: 'Display name can only contain letters, numbers, spaces, hyphens, and underscores',
        },
      },
    };
  }

  return { displayName };
};
