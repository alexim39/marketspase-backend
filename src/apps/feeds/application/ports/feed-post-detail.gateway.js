export class FeedPostDetailGateway {
  async findPostById(_postId) {
    throw new Error('FeedPostDetailGateway.findPostById must be implemented');
  }

  async trackPostView(_command = {}) {
    throw new Error('FeedPostDetailGateway.trackPostView must be implemented');
  }
}
