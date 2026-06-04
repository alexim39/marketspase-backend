import { ListReceivedReviewsDto } from '../dto/list-received-reviews.dto.js';

export class ListReceivedReviewsUseCase {
  constructor({ collaborationReviewGateway } = {}) {
    if (!collaborationReviewGateway) {
      throw new Error('collaborationReviewGateway is required');
    }

    this.collaborationReviewGateway = collaborationReviewGateway;
  }

  async execute(input) {
    const dto = input instanceof ListReceivedReviewsDto
      ? input
      : new ListReceivedReviewsDto(input);

    if (!this.collaborationReviewGateway.isValidObjectId(dto.userId)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'Invalid user ID.',
        },
      };
    }

    const result = await this.collaborationReviewGateway.listReceivedReviews({
      userId: dto.userId,
      page: dto.page,
      limit: dto.limit,
      includeHidden: dto.includeHidden,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        data: result.reviews,
        pagination: result.pagination,
        summary: result.summary,
      },
    };
  }
}
