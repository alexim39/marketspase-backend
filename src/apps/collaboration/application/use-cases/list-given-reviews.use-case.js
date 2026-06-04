import { ListGivenReviewsDto } from '../dto/list-given-reviews.dto.js';

export class ListGivenReviewsUseCase {
  constructor({ collaborationReviewGateway } = {}) {
    if (!collaborationReviewGateway) {
      throw new Error('collaborationReviewGateway is required');
    }

    this.collaborationReviewGateway = collaborationReviewGateway;
  }

  async execute(input) {
    const dto = input instanceof ListGivenReviewsDto
      ? input
      : new ListGivenReviewsDto(input);

    if (!this.collaborationReviewGateway.isValidObjectId(dto.userId)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'Invalid user ID.',
        },
      };
    }

    const result = await this.collaborationReviewGateway.listGivenReviews({
      userId: dto.userId,
      page: dto.page,
      limit: dto.limit,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        data: result.reviews,
        pagination: result.pagination,
      },
    };
  }
}
