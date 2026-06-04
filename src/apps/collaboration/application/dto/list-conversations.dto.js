const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

const parseLimit = (value, fallback = DEFAULT_LIMIT) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, MAX_LIMIT);
};

export class ListConversationsDto {
  constructor({ userId = null, query = {} } = {}) {
    this.userId = userId || null;
    this.kind = String(query.kind || 'all');
    this.search = String(query.search || '').trim().toLowerCase();
    this.limit = parseLimit(query.limit);
  }

  static fromRequest({ user = null, query = {} } = {}) {
    return new ListConversationsDto({
      userId: user?._id,
      query: query || {},
    });
  }
}
