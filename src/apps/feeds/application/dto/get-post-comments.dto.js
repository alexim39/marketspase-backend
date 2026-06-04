export class GetPostCommentsDto {
  constructor({
    postId = null,
    userId = null,
    page = 1,
    limit = 20,
  } = {}) {
    this.postId = postId;
    this.userId = userId || null;
    this.page = parseInt(page);
    this.limit = parseInt(limit);
  }

  static fromRequest({ params = {}, query = {}, userId = null } = {}) {
    return new GetPostCommentsDto({
      postId: params.postId || null,
      userId: userId || null,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }
}
