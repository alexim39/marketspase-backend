const normalizeString = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");

const normalizeArrayStrings = (values) =>
  Array.isArray(values)
    ? values.map((value) => normalizeString(value)).filter(Boolean)
    : [];

const calculateAge = (dob) => {
  if (!dob) return null;

  try {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1;
    }

    return age;
  } catch {
    return null;
  }
};

const getAgeGroup = (age) => {
  if (age === null) return "all";
  if (age < 18) return "all";
  if (age <= 24) return "young";
  if (age <= 44) return "middle";
  return "advanced";
};

const extractUserLocation = (user) => {
  const address = user?.personalInfo?.address ?? {};

  return {
    street: normalizeString(address.street),
    city: normalizeString(address.city),
    state: normalizeString(address.state),
    country: normalizeString(address.country),
  };
};

const buildPromoterTags = (promoter) =>
  Array.from(
    new Set([
      ...normalizeArrayStrings(promoter?.tags),
      ...normalizeArrayStrings(promoter?.interests?.favoriteTopics),
      ...normalizeArrayStrings(promoter?.interests?.hobbies),
      ...normalizeArrayStrings(promoter?.professionalInfo?.skills),
    ])
  );

const hasMatchingTargetLocation = (targetLocations = [], userLocation = {}) => {
  if (!Array.isArray(targetLocations) || targetLocations.length === 0) {
    return true;
  }

  const locationTerms = [userLocation.street, userLocation.city, userLocation.state, userLocation.country]
    .map((value) => normalizeString(value))
    .filter(Boolean);

  if (locationTerms.length === 0) {
    return false;
  }

  return targetLocations.some((location) => {
    const haystack = normalizeString(location?.name);
    return locationTerms.some((term) => haystack.includes(term));
  });
};

const hasAllRequirements = (campaignRequirements = [], promoterTags = []) => {
  const normalizedRequirements = normalizeArrayStrings(campaignRequirements);
  if (normalizedRequirements.length === 0) {
    return true;
  }

  if (promoterTags.length === 0) {
    return false;
  }

  return normalizedRequirements.every((requirement) => promoterTags.includes(requirement));
};

export const evaluateCampaignTargetEligibility = ({ campaign, promoter }) => {
  if (!campaign?.enableTarget) {
    return { eligible: true, reasons: [] };
  }

  const reasons = [];
  const age = calculateAge(promoter?.personalInfo?.dob);
  const ageGroup = getAgeGroup(age);
  const promoterRating = Number.isFinite(Number(promoter?.rating)) ? Number(promoter.rating) : 0;
  const promoterTags = buildPromoterTags(promoter);
  const promoterLocation = extractUserLocation(promoter);

  if (campaign.ageTarget && campaign.ageTarget !== "all" && ageGroup !== campaign.ageTarget) {
    reasons.push("age target does not match this campaign");
  }

  if (Number.isFinite(Number(campaign.minRating)) && promoterRating < Number(campaign.minRating)) {
    reasons.push("minimum rating requirement is not met");
  }

  if (!hasAllRequirements(campaign.requirements, promoterTags)) {
    reasons.push("required interests or skills are missing");
  }

  if (!hasMatchingTargetLocation(campaign.targetLocations, promoterLocation)) {
    reasons.push("location target does not match this campaign");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
};
