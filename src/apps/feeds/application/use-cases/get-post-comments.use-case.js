import { GetPostCommentsDto } from '../dto/get-post-comments.dto.js';

const isSameId = (left, right) => left?.toString?.() === right?.toString?.();

const shapeComment = (comment, userId) => {
  const shaped = { ...comment };
  shaped.likeCount = shaped.likes?.length || 0;
  shaped.isLiked = userId
    ? (shaped.likes?.some((like) => isSameId(like, userId)) || false)
    : false;
  delete shaped.likes;

  if (shaped.replies && shaped.replies.length) {
    shaped.replies = shaped.replies.map((reply) => {
      const shapedReply = { ...reply };
      shapedReply.likeCount = shapedReply.likes?.length || 0;
      shapedReply.isLiked = userId
        ? (shapedReply.likes?.some((like) => isSameId(like, userId)) || false)
        : false;
      delete shapedReply.likes;
      return shapedReply;
    });
  }

  return shaped;
};

export class GetPostCommentsUseCase {
  constructor({ feedCommentsGateway } = {}) {
    if (!feedCommentsGateway) {
      throw new Error('feedCommentsGateway is required');
    }

    this.feedCommentsGateway = feedCommentsGateway;
  }

  async execute(input) {
    const dto = input instanceof GetPostCommentsDto
      ? input
      : new GetPostCommentsDto(input);

    const post = await this.feedCommentsGateway.findPostCommentsById(dto.postId);

    if (!post) {
      return {
        statusCode: 404,
        errorMessage: 'Post not found',
      };
    }

    const allComments = post.comments || [];
    const start = (dto.page - 1) * dto.limit;
    const paginatedComments = allComments.slice(start, start + dto.limit);
    const processed = paginatedComments.map((comment) => shapeComment(comment, dto.userId));

    return {
      statusCode: 200,
      body: {
        statusCode: 200,
        data: {
          comments: processed,
          total: allComments.length,
          page: dto.page,
          pages: Math.ceil(allComments.length / dto.limit),
        },
        message: 'Comments fetched successfully',
        success: true,
      },
    };
  }
}
