import { GetReviewEligibilityDto } from '../dto/get-review-eligibility.dto.js';

export class GetReviewEligibilityUseCase {
  constructor({ collaborationReviewGateway } = {}) {
    if (!collaborationReviewGateway) {
      throw new Error('collaborationReviewGateway is required');
    }

    this.collaborationReviewGateway = collaborationReviewGateway;
  }

  async execute(input) {
    const dto = input instanceof GetReviewEligibilityDto
      ? input
      : new GetReviewEligibilityDto(input);

    const result = await this.collaborationReviewGateway.getReviewEligibility({
      reviewerId: dto.reviewerId,
      revieweeId: dto.revieweeId,
      promotionId: dto.promotionId,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        data: result,
      },
    };
  }
}
