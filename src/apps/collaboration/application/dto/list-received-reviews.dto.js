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

export class ListReceivedReviewsDto {
  constructor({ userId = '', requesterRole = '', query = {} } = {}) {
    this.userId = userId || '';
    this.page = parsePage(query.page);
    this.limit = parseLimit(query.limit);
    this.includeHidden = requesterRole === 'admin' && query.includeHidden === 'true';
  }

  static fromRequest({ user = null, params = {}, query = {} } = {}) {
    return new ListReceivedReviewsDto({
      userId: params.userId,
      requesterRole: user?.role || '',
      query: query || {},
    });
  }
}
