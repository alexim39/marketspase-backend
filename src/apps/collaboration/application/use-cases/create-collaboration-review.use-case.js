import { CreateCollaborationReviewDto } from '../dto/create-collaboration-review.dto.js';

export class CreateCollaborationReviewUseCase {
  constructor({ collaborationReviewGateway } = {}) {
    if (!collaborationReviewGateway) {
      throw new Error('collaborationReviewGateway is required');
    }

    this.collaborationReviewGateway = collaborationReviewGateway;
  }

  async execute(input) {
    const dto = input instanceof CreateCollaborationReviewDto
      ? input
      : new CreateCollaborationReviewDto(input);

    if (!this.collaborationReviewGateway.isValidObjectId(dto.revieweeId)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'A valid review target is required.',
        },
      };
    }

    if (!this.collaborationReviewGateway.isValidObjectId(dto.promotionId)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'A valid collaboration promotion is required.',
        },
      };
    }

    if (!Number.isFinite(dto.rating) || dto.rating < 1 || dto.rating > 5) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'Rating must be between 1 and 5.',
        },
      };
    }

    const eligibility = await this.collaborationReviewGateway.getReviewEligibility({
      reviewerId: dto.reviewerId,
      revieweeId: dto.revieweeId,
      promotionId: dto.promotionId,
    });

    if (!eligibility.eligible) {
      return {
        statusCode: 403,
        body: {
          success: false,
          message: eligibility.reason || 'You cannot review this collaboration yet.',
        },
      };
    }

    const review = await this.collaborationReviewGateway.createReview({
      reviewerId: dto.reviewerId,
      revieweeId: dto.revieweeId,
      campaignId: eligibility.campaign?._id || null,
      promotionId: eligibility.promotion?._id || null,
      relationshipType: eligibility.relationshipType,
      rating: dto.rating,
      title: dto.title,
      comment: dto.comment,
      status: 'published',
      publishedAt: new Date(),
    });

    await this.collaborationReviewGateway.recomputeCollaborationRating(dto.revieweeId);

    const populatedReview = await this.collaborationReviewGateway.getReviewById(review._id);
    await this.collaborationReviewGateway.notifyReviewReceived(dto.revieweeId, populatedReview);

    return {
      statusCode: 201,
      body: {
        success: true,
        data: populatedReview,
        message: 'Review published successfully.',
      },
    };
  }
}
