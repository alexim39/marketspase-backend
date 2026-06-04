export class GetFeedPostsDto {
  constructor({
    page = 1,
    limit = 20,
    type = undefined,
    sort = 'trending',
    hashtag = undefined,
    author = undefined,
    userId = null,
  } = {}) {
    this.page = parseInt(page);
    this.limit = parseInt(limit);
    this.type = type;
    this.sort = sort;
    this.hashtag = hashtag;
    this.author = author;
    this.userId = userId || null;
  }

  static fromRequest({ query = {}, userId = null } = {}) {
    return new GetFeedPostsDto({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      type: query.type,
      sort: query.sort ?? 'trending',
      hashtag: query.hashtag,
      author: query.author,
      userId: userId || null,
    });
  }
}
