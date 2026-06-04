export class TrackPostChatClickDto {
  constructor({ postId = undefined } = {}) {
    this.postId = postId;
  }

  static fromRequest({ params = {} } = {}) {
    return new TrackPostChatClickDto({
      postId: params.postId,
    });
  }
}
