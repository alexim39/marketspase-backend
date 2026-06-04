const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const parseLimit = (value, fallback = DEFAULT_LIMIT) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, MAX_LIMIT);
};

const parsePage = (value) => Math.max(Number.parseInt(value, 10) || 1, 1);

export class GetConversationMessagesDto {
  constructor({ user = null, conversationId = '', query = {} } = {}) {
    this.user = user || null;
    this.conversationId = conversationId || '';
    this.page = parsePage(query.page);
    this.limit = parseLimit(query.limit);
  }

  static fromRequest({ user = null, params = {}, query = {} } = {}) {
    return new GetConversationMessagesDto({
      user: user || null,
      conversationId: params.conversationId,
      query: query || {},
    });
  }
}
