const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

const parsePage = (value) => Math.max(Number.parseInt(value, 10) || 1, 1);

const parseLimit = (value, fallback = DEFAULT_LIMIT) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, MAX_LIMIT);
};

export class ListGivenReviewsDto {
  constructor({ userId = '', query = {} } = {}) {
    this.userId = userId || '';
    this.page = parsePage(query.page);
    this.limit = parseLimit(query.limit);
  }

  static fromRequest({ params = {}, query = {} } = {}) {
    return new ListGivenReviewsDto({
      userId: params.userId,
      query: query || {},
    });
  }
}
