import { ModerateCollaborationReviewDto } from '../dto/moderate-collaboration-review.dto.js';

const buildModerationUpdate = ({ action, note, response, adminId } = {}) => {
  const update = {
    moderationNotes: note,
    adminResponse: response,
    moderatedBy: adminId,
  };

  if (action === 'publish') {
    update.status = 'published';
    update.hiddenAt = null;
    return update;
  }

  if (action === 'hide') {
    update.status = 'hidden';
    update.hiddenAt = new Date();
    return update;
  }

  if (action === 'remove') {
    update.status = 'removed';
    update.hiddenAt = new Date();
    return update;
  }

  if (action === 'restore') {
    update.status = 'published';
    update.hiddenAt = null;
    return update;
  }

  return null;
};

export class ModerateCollaborationReviewUseCase {
  constructor({ collaborationReviewGateway } = {}) {
    if (!collaborationReviewGateway) {
      throw new Error('collaborationReviewGateway is required');
    }

    this.collaborationReviewGateway = collaborationReviewGateway;
  }

  async execute(input) {
    const dto = input instanceof ModerateCollaborationReviewDto
      ? input
      : new ModerateCollaborationReviewDto(input);

    const review = await this.collaborationReviewGateway.findReviewById(dto.reviewId);
    if (!review) {
      return {
        statusCode: 404,
        body: {
          success: false,
          message: 'Review not found.',
        },
      };
    }

    const update = buildModerationUpdate({
      action: dto.action,
      note: dto.note,
      response: dto.response,
      adminId: dto.adminId,
    });

    if (!update) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'Unknown moderation action.',
        },
      };
    }

    const updatedReview = await this.collaborationReviewGateway.updateReviewModeration({
      reviewId: review._id,
      update,
    });

    await this.collaborationReviewGateway.recomputeCollaborationRating(review.reviewee);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: updatedReview,
        message: 'Review moderation updated.',
      },
    };
  }
}
