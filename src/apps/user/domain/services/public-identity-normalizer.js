export const PUBLIC_IDENTITY_SOCIAL_FIELDS = {
  website: 'professionalInfo.socialProfiles.website',
  instagram: 'professionalInfo.socialProfiles.instagram',
  tiktok: 'professionalInfo.socialProfiles.tiktok',
  facebook: 'professionalInfo.socialProfiles.facebook',
  x: 'professionalInfo.socialProfiles.x',
  youtube: 'professionalInfo.socialProfiles.youtube',
  linkedin: 'professionalInfo.socialProfiles.linkedin',
};

export const normalizePublicIdentityString = (value, maxLength = null) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return '';
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return '';
  }

  return maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

export const isValidPublicUsername = (username) => /^[a-zA-Z0-9_]+$/.test(username);

export const buildPublicIdentityUpdateFields = (payload = {}) => {
  const updateFields = {};

  if (payload.username !== undefined) {
    const normalizedUsername = normalizePublicIdentityString(payload.username, 30);

    if (!normalizedUsername) {
      return {
        error: {
          statusCode: 400,
          body: {
            success: false,
            message: 'Username is required.',
          },
        },
      };
    }

    if (!isValidPublicUsername(normalizedUsername)) {
      return {
        error: {
          statusCode: 400,
          body: {
            success: false,
            message: 'Username can only contain letters, numbers, and underscores.',
          },
        },
      };
    }

    updateFields.username = normalizedUsername;
    updateFields['referralInfo.referralCode'] = normalizedUsername;
  }

  for (const [incomingField, targetField] of Object.entries(PUBLIC_IDENTITY_SOCIAL_FIELDS)) {
    if (payload[incomingField] !== undefined) {
      updateFields[targetField] = normalizePublicIdentityString(payload[incomingField], 300);
    }
  }

  return { updateFields };
};
