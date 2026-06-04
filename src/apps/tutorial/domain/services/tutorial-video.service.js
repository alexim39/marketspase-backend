const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value ?? {}, key);

export const getRecentVideoFlag = (video) => Boolean(video?.isRecentlyAdded ?? video?.isNew);

export const normalizeTutorialVideoPayload = (payload = {}) => {
  const normalized = { ...payload };

  if (hasOwn(normalized, 'isNew') && !hasOwn(normalized, 'isRecentlyAdded')) {
    normalized.isRecentlyAdded = Boolean(normalized.isNew);
  }

  delete normalized.isNew;

  return normalized;
};

export const extractYouTubeId = (url) => {
  if (!url) {
    return null;
  }

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return url;
};
