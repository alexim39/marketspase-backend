import { ListAdminReviewsDto } from '../dto/list-admin-reviews.dto.js';

export class ListAdminReviewsUseCase {
  constructor({ collaborationReviewGateway } = {}) {
    if (!collaborationReviewGateway) {
      throw new Error('collaborationReviewGateway is required');
    }

    this.collaborationReviewGateway = collaborationReviewGateway;
  }

  async execute(input) {
    const dto = input instanceof ListAdminReviewsDto
      ? input
      : new ListAdminReviewsDto(input);

    const result = await this.collaborationReviewGateway.listAdminReviews({
      page: dto.page,
      limit: dto.limit,
      search: dto.search,
      status: dto.status,
      flaggedOnly: dto.flaggedOnly,
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
