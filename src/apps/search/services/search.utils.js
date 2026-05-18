const STOP_WORDS = new Set([
  'a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'to', 'with',
]);

export const normalizeSearchText = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const splitSearchTokens = (value = '') => normalizeSearchText(value)
  .split(' ')
  .map((token) => token.trim())
  .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
  .slice(0, 8);

export const uniqueStrings = (values = []) => [...new Set(
  values
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean)
)];

export const buildSearchTerms = (values = []) => uniqueStrings(
  values.flatMap((value) => splitSearchTokens(value))
);

export const buildSearchPrefixes = (terms = []) => {
  const prefixes = new Set();

  for (const term of terms) {
    const maxLength = Math.min(term.length, 12);
    for (let length = 2; length <= maxLength; length += 1) {
      prefixes.add(term.slice(0, length));
    }
  }

  return [...prefixes];
};

export const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const firstNonEmpty = (...values) => values.find((value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  return String(value || '').trim().length > 0;
});

export const cleanObject = (value) => Object.fromEntries(
  Object.entries(value || {}).filter(([, entry]) => {
    if (entry == null) {
      return false;
    }

    if (Array.isArray(entry)) {
      return entry.length > 0;
    }

    if (typeof entry === 'object') {
      return Object.keys(entry).length > 0;
    }

    return String(entry).trim().length > 0;
  })
);
