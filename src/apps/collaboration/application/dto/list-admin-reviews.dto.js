const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const parsePage = (value) => Math.max(Number.parseInt(value, 10) || 1, 1);

const parseLimit = (value, fallback = DEFAULT_LIMIT) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, MAX_LIMIT);
};

export class ListAdminReviewsDto {
  constructor({ query = {} } = {}) {
    this.page = parsePage(query.page);
    this.limit = parseLimit(query.limit);
    this.search = String(query.search || '').trim();
    this.status = String(query.status || 'all');
    this.flaggedOnly = query.flaggedOnly === 'true';
  }

  static fromRequest({ query = {} } = {}) {
    return new ListAdminReviewsDto({ query: query || {} });
  }
}
