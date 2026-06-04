import { GetPostByIdDto } from '../dto/get-post-by-id.dto.js';

export class GetPostByIdUseCase {
  constructor({
    feedPostDetailGateway,
    shapePost = (post) => post,
  } = {}) {
    if (!feedPostDetailGateway) {
      throw new Error('feedPostDetailGateway is required');
    }

    this.feedPostDetailGateway = feedPostDetailGateway;
    this.shapePost = shapePost;
  }

  async execute(input) {
    const dto = input instanceof GetPostByIdDto
      ? input
      : new GetPostByIdDto(input);

    const post = await this.feedPostDetailGateway.findPostById(dto.postId);

    if (!post) {
      return {
        statusCode: 404,
        errorMessage: 'Post not found',
      };
    }

    await this.feedPostDetailGateway.trackPostView({
      postId: dto.postId,
      userId: dto.userId,
    });

    return {
      statusCode: 200,
      body: {
        statusCode: 200,
        data: this.shapePost(post, dto.userId),
        message: 'Post fetched successfully',
        success: true,
      },
    };
  }
}
