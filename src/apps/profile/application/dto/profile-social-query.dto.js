const toInteger = (value) => Number.parseInt(value, 10);

export class GetProfileDto {
  constructor({ userId = null, currentUserId = null, view = null } = {}) {
    this.userId = userId;
    this.currentUserId = currentUserId;
    this.view = view;
  }

  static fromRequest({ userId = null, params = {}, query = {}, user = null } = {}) {
    return new GetProfileDto({
      userId: params?.userId || null,
      currentUserId: userId || user?._id || query?.currentUserId || null,
      view: query?.view || null,
    });
  }
}

export class GetUserPostsDto {
  constructor({ user = null, userId = null, query = {} } = {}) {
    this.user = user;
    this.userId = userId;
    this.page = query.page ?? 1;
    this.limit = query.limit ?? 10;
    this.pageNumber = toInteger(this.page);
    this.limitNumber = toInteger(this.limit);
    this.skip = (this.page - 1) * this.limit;
    this.currentViewerId = user?._id || query.currentUserId || null;
  }

  static fromRequest({ user = null, params = {}, query = {} } = {}) {
    return new GetUserPostsDto({
      user,
      userId: params?.userId || null,
      query,
    });
  }
}

export class ListFollowersDto {
  constructor({ userId = null, query = {} } = {}) {
    this.userId = userId;
    this.page = query.page ?? 1;
    this.limit = query.limit ?? 20;
    this.pageNumber = toInteger(this.page);
    this.limitNumber = toInteger(this.limit);
    this.skip = (this.page - 1) * this.limit;
  }

  static fromRequest({ params = {}, query = {} } = {}) {
    return new ListFollowersDto({
      userId: params?.userId || null,
      query,
    });
  }
}

export class ListFollowingDto {
  constructor({ userId = null, query = {} } = {}) {
    this.userId = userId;
    this.page = query.page ?? 1;
    this.limit = query.limit ?? 20;
    this.pageNumber = toInteger(this.page);
    this.limitNumber = toInteger(this.limit);
    this.skip = (this.page - 1) * this.limit;
  }

  static fromRequest({ params = {}, query = {} } = {}) {
    return new ListFollowingDto({
      userId: params?.userId || null,
      query,
    });
  }
}

export class GetSuggestedUsersDto {
  constructor({ query = {} } = {}) {
    this.userId = query.userId || null;
    this.limit = query.limit ?? 5;
    this.limitNumber = toInteger(this.limit);
  }

  static fromRequest({ query = {} } = {}) {
    return new GetSuggestedUsersDto({ query });
  }
}

export class ToggleFollowDto {
  constructor({ userId = null, currentUserId = null } = {}) {
    this.userId = userId;
    this.currentUserId = currentUserId;
  }

  static fromRequest({ user = null, userId = null, params = {}, body = {} } = {}) {
    return new ToggleFollowDto({
      userId: params?.userId || null,
      currentUserId: userId || user?._id || body?.currentUserId || null,
    });
  }
}
