import { FlagCollaborationReviewDto } from '../dto/flag-collaboration-review.dto.js';

const toIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return toIdString(value._id);
  return String(value);
};

export class FlagCollaborationReviewUseCase {
  constructor({ collaborationReviewGateway } = {}) {
    if (!collaborationReviewGateway) {
      throw new Error('collaborationReviewGateway is required');
    }

    this.collaborationReviewGateway = collaborationReviewGateway;
  }

  async execute(input) {
    const dto = input instanceof FlagCollaborationReviewDto
      ? input
      : new FlagCollaborationReviewDto(input);

    if (!dto.reason) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'A flag reason is required.',
        },
      };
    }

    const review = await this.collaborationReviewGateway.findReviewForFlag(dto.reviewId);
    if (!review) {
      return {
        statusCode: 404,
        body: {
          success: false,
          message: 'Review not found.',
        },
      };
    }

    const alreadyFlagged = (review.flags || [])
      .some((flag) => toIdString(flag.user) === toIdString(dto.userId));
    if (alreadyFlagged) {
      return {
        statusCode: 409,
        body: {
          success: false,
          message: 'You have already flagged this review.',
        },
      };
    }

    const updatedReview = await this.collaborationReviewGateway.flagReview({
      reviewId: dto.reviewId,
      userId: dto.userId,
      reason: dto.reason,
      details: dto.details,
      currentStatus: review.status,
    });

    const adminRecipients = await this.collaborationReviewGateway.getAdminNotificationRecipients();
    await Promise.all((adminRecipients || []).map((admin) =>
      this.collaborationReviewGateway.notifyReviewFlagged(admin._id, updatedReview, dto.reason)
    ));

    return {
      statusCode: 200,
      body: {
        success: true,
        data: updatedReview,
        message: 'Review flagged for moderation.',
      },
    };
  }
}
