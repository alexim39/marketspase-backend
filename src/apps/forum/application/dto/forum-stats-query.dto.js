const getViewerId = ({ userId = null, user = null } = {}) => (
  userId || user?._id?.toString?.() || null
);

export const clampForumLimit = (value, fallback = 5) => Math.max(
  1,
  Math.min(20, Number(value || fallback)),
);

export const getForumTrendTimeframeDays = (timeframe) => (
  timeframe === 'day' ? 1 : timeframe === 'month' ? 30 : 7
);

export const getForumMonthlyTimeframeDays = (timeframe) => (
  timeframe === 'week' ? 7 : timeframe === 'all' ? 3650 : 30
);

class BaseForumStatsDto {
  constructor({ user = null, userId = null, query = {} } = {}) {
    this.user = user;
    this.userId = getViewerId({ userId, user });
    this.query = query || {};
  }
}

export class GetCommunityStatsDto extends BaseForumStatsDto {
  static fromRequest({ user = null, userId = null, query = {} } = {}) {
    return new GetCommunityStatsDto({ user, userId, query });
  }
}

export class GetPinnedThreadsDto extends BaseForumStatsDto {
  constructor(input = {}) {
    super(input);
    this.limit = clampForumLimit(this.query.limit, 5);
  }

  static fromRequest({ user = null, userId = null, query = {} } = {}) {
    return new GetPinnedThreadsDto({ user, userId, query });
  }
}

export class GetTrendingThreadsDto extends BaseForumStatsDto {
  constructor(input = {}) {
    super(input);
    this.limit = clampForumLimit(this.query.limit, 5);
    this.timeframe = this.query.timeframe || 'week';
    this.timeframeDays = getForumTrendTimeframeDays(this.timeframe);
  }

  static fromRequest({ user = null, userId = null, query = {} } = {}) {
    return new GetTrendingThreadsDto({ user, userId, query });
  }
}

export class GetActiveUsersDto extends BaseForumStatsDto {
  constructor(input = {}) {
    super(input);
    this.limit = clampForumLimit(this.query.limit, 5);
    this.timeframe = this.query.timeframe || 'month';
    this.timeframeDays = getForumMonthlyTimeframeDays(this.timeframe);
  }

  static fromRequest({ user = null, userId = null, query = {} } = {}) {
    return new GetActiveUsersDto({ user, userId, query });
  }
}

export class GetPopularTagsDto extends BaseForumStatsDto {
  constructor(input = {}) {
    super(input);
    this.limit = clampForumLimit(this.query.limit, 10);
    this.timeframe = this.query.timeframe || 'month';
    this.timeframeDays = getForumMonthlyTimeframeDays(this.timeframe);
  }

  static fromRequest({ user = null, userId = null, query = {} } = {}) {
    return new GetPopularTagsDto({ user, userId, query });
  }
}

export class GetHotTopicsDto extends BaseForumStatsDto {
  constructor(input = {}) {
    super(input);
    this.limit = clampForumLimit(this.query.limit, 8);
    this.timeframe = this.query.timeframe || 'week';
    this.timeframeDays = getForumTrendTimeframeDays(this.timeframe);
  }

  static fromRequest({ user = null, userId = null, query = {} } = {}) {
    return new GetHotTopicsDto({ user, userId, query });
  }
}
