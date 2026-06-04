export class GetPostByIdDto {
  constructor({ postId = null, userId = null } = {}) {
    this.postId = postId;
    this.userId = userId || null;
  }

  static fromRequest({ params = {}, userId = null } = {}) {
    return new GetPostByIdDto({
      postId: params.postId || null,
      userId: userId || null,
    });
  }
}
