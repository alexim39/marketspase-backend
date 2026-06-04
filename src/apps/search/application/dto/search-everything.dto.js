const parseCsvList = (value) => String(value || '')
  .split(',')
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

const clamp = (value, minimum, maximum, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(minimum, Math.min(maximum, Math.trunc(numeric)));
};

export class SearchEverythingDto {
  constructor({ query = {}, viewer } = {}) {
    this.query = query.q || query.query || '';
    this.types = parseCsvList(query.types);
    this.userTypes = parseCsvList(query.userTypes);
    this.statuses = parseCsvList(query.statuses);
    this.region = query.region || '';
    this.page = clamp(query.page, 1, 5000, 1);
    this.limit = clamp(query.limit, 1, 50, 12);
    this.viewer = viewer;
  }

  static fromRequest({ query, user }) {
    return new SearchEverythingDto({
      query,
      viewer: user,
    });
  }
}

export { clamp, parseCsvList };
