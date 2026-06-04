export const PROFESSIONAL_TEXT_FIELDS = {
  jobTitle: ['professionalInfo.jobTitle', 80],
  certificate: ['professionalInfo.education.certificate', 160],
  profileHeadline: ['professionalInfo.profileHeadline', 160],
  brandName: ['professionalInfo.businessProfile.brandName', 120],
  brandSummary: ['professionalInfo.businessProfile.brandSummary', 1000],
};

export const PROFESSIONAL_ARRAY_FIELDS = {
  skills: ['professionalInfo.skills', 20, 80],
  hobbies: ['interests.hobbies', 20, 80],
  uniqueSellingPoints: ['professionalInfo.businessProfile.uniqueSellingPoints', 8, 160],
};

export const PROFESSIONAL_SOCIAL_FIELDS = {
  website: 'professionalInfo.socialProfiles.website',
  instagram: 'professionalInfo.socialProfiles.instagram',
  tiktok: 'professionalInfo.socialProfiles.tiktok',
  facebook: 'professionalInfo.socialProfiles.facebook',
  x: 'professionalInfo.socialProfiles.x',
  youtube: 'professionalInfo.socialProfiles.youtube',
  linkedin: 'professionalInfo.socialProfiles.linkedin',
};

export const normalizeProfessionalString = (value, maxLength = null) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return '';
  }

  return maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

export const normalizeProfessionalStringArray = (value, maxItems = 10, maxLength = 160) => {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(
    value
      .map((item) => normalizeProfessionalString(item, maxLength))
      .filter(Boolean),
  )).slice(0, maxItems);
};

export const buildProfessionalProfileUpdateFields = (payload = {}) => {
  const updateFields = {};

  for (const [incomingField, [targetField, maxLength]] of Object.entries(PROFESSIONAL_TEXT_FIELDS)) {
    if (payload[incomingField] !== undefined) {
      updateFields[targetField] = normalizeProfessionalString(payload[incomingField], maxLength);
    }
  }

  for (const [incomingField, [targetField, maxItems, maxLength]] of Object.entries(PROFESSIONAL_ARRAY_FIELDS)) {
    if (payload[incomingField] !== undefined) {
      updateFields[targetField] = normalizeProfessionalStringArray(payload[incomingField], maxItems, maxLength);
    }
  }

  for (const [incomingField, targetField] of Object.entries(PROFESSIONAL_SOCIAL_FIELDS)) {
    if (payload[incomingField] !== undefined) {
      updateFields[targetField] = normalizeProfessionalString(payload[incomingField], 300);
    }
  }

  return updateFields;
};
