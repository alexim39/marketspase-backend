import test from 'node:test';
import assert from 'node:assert/strict';

import { CreateCollaborationReviewDto } from '../application/dto/create-collaboration-review.dto.js';
import { FlagCollaborationReviewDto } from '../application/dto/flag-collaboration-review.dto.js';
import { ModerateCollaborationReviewDto } from '../application/dto/moderate-collaboration-review.dto.js';
import { CreateCollaborationReviewUseCase } from '../application/use-cases/create-collaboration-review.use-case.js';
import { FlagCollaborationReviewUseCase } from '../application/use-cases/flag-collaboration-review.use-case.js';
import { ModerateCollaborationReviewUseCase } from '../application/use-cases/moderate-collaboration-review.use-case.js';

test('CreateCollaborationReviewUseCase preserves validation guards', async () => {
  const useCase = new CreateCollaborationReviewUseCase({
    collaborationReviewGateway: {
      isValidObjectId(value) {
        return value === 'valid-id';
      },
    },
  });

  assert.deepEqual(await useCase.execute(new CreateCollaborationReviewDto({
    reviewerId: 'reviewer',
    body: {
      revieweeId: 'bad-target',
      promotionId: 'valid-id',
      rating: 5,
    },
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'A valid review target is required.',
    },
  });

  assert.deepEqual(await useCase.execute(new CreateCollaborationReviewDto({
    reviewerId: 'reviewer',
    body: {
      revieweeId: 'valid-id',
      promotionId: 'bad-promotion',
      rating: 5,
    },
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'A valid collaboration promotion is required.',
    },
  });

  assert.deepEqual(await useCase.execute(new CreateCollaborationReviewDto({
    reviewerId: 'reviewer',
    body: {
      revieweeId: 'valid-id',
      promotionId: 'valid-id',
      rating: 6,
    },
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Rating must be between 1 and 5.',
    },
  });
});

test('CreateCollaborationReviewUseCase preserves eligibility rejection response', async () => {
  const useCase = new CreateCollaborationReviewUseCase({
    collaborationReviewGateway: {
      isValidObjectId() {
        return true;
      },
      async getReviewEligibility() {
        return {
          eligible: false,
          reason: 'Please allow the collaboration to progress before leaving feedback.',
        };
      },
    },
  });

  assert.deepEqual(await useCase.execute(new CreateCollaborationReviewDto({
    reviewerId: 'reviewer-1',
    body: {
      revieweeId: 'reviewee-1',
      promotionId: 'promotion-1',
      rating: 4,
    },
  })), {
    statusCode: 403,
    body: {
      success: false,
      message: 'Please allow the collaboration to progress before leaving feedback.',
    },
  });
});

test('CreateCollaborationReviewUseCase creates review, recomputes rating, notifies user, and returns legacy response', async () => {
  const calls = [];
  const populatedReview = { _id: 'review-1', rating: 5 };
  const useCase = new CreateCollaborationReviewUseCase({
    collaborationReviewGateway: {
      isValidObjectId() {
        return true;
      },
      async getReviewEligibility(query) {
        calls.push(['eligibility', query]);
        return {
          eligible: true,
          campaign: { _id: 'campaign-1' },
          promotion: { _id: 'promotion-1' },
          relationshipType: 'marketer_to_promoter',
        };
      },
      async createReview(command) {
        calls.push(['create', {
          ...command,
          publishedAtIsDate: command.publishedAt instanceof Date,
          publishedAt: undefined,
        }]);
        return { _id: 'review-1' };
      },
      async recomputeCollaborationRating(userId) {
        calls.push(['recompute', userId]);
      },
      async getReviewById(reviewId) {
        calls.push(['getById', reviewId]);
        return populatedReview;
      },
      async notifyReviewReceived(userId, review) {
        calls.push(['notifyReceived', userId, review]);
      },
    },
  });

  const result = await useCase.execute(CreateCollaborationReviewDto.fromRequest({
    user: { _id: 'reviewer-1' },
    body: {
      revieweeId: 'reviewee-1',
      promotionId: 'promotion-1',
      rating: '5',
      title: ' Great work ',
      comment: ' Helpful partner ',
    },
  }));

  assert.deepEqual(calls, [
    ['eligibility', {
      reviewerId: 'reviewer-1',
      revieweeId: 'reviewee-1',
      promotionId: 'promotion-1',
    }],
    ['create', {
      reviewerId: 'reviewer-1',
      revieweeId: 'reviewee-1',
      campaignId: 'campaign-1',
      promotionId: 'promotion-1',
      relationshipType: 'marketer_to_promoter',
      rating: 5,
      title: 'Great work',
      comment: 'Helpful partner',
      status: 'published',
      publishedAtIsDate: true,
      publishedAt: undefined,
    }],
    ['recompute', 'reviewee-1'],
    ['getById', 'review-1'],
    ['notifyReceived', 'reviewee-1', populatedReview],
  ]);
  assert.deepEqual(result, {
    statusCode: 201,
    body: {
      success: true,
      data: populatedReview,
      message: 'Review published successfully.',
    },
  });
});

test('FlagCollaborationReviewUseCase preserves reason, missing review, and duplicate flag guards', async () => {
  const noReasonUseCase = new FlagCollaborationReviewUseCase({
    collaborationReviewGateway: {},
  });

  assert.deepEqual(await noReasonUseCase.execute(new FlagCollaborationReviewDto({
    reviewId: 'review-1',
    userId: 'user-1',
    body: {},
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'A flag reason is required.',
    },
  });

  const missingUseCase = new FlagCollaborationReviewUseCase({
    collaborationReviewGateway: {
      async findReviewForFlag() {
        return null;
      },
    },
  });

  assert.deepEqual(await missingUseCase.execute(new FlagCollaborationReviewDto({
    reviewId: 'review-1',
    userId: 'user-1',
    body: { reason: 'Spam' },
  })), {
    statusCode: 404,
    body: {
      success: false,
      message: 'Review not found.',
    },
  });

  const duplicateUseCase = new FlagCollaborationReviewUseCase({
    collaborationReviewGateway: {
      async findReviewForFlag() {
        return {
          flags: [{ user: { _id: 'user-1' } }],
        };
      },
    },
  });

  assert.deepEqual(await duplicateUseCase.execute(new FlagCollaborationReviewDto({
    reviewId: 'review-1',
    userId: 'user-1',
    body: { reason: 'Spam' },
  })), {
    statusCode: 409,
    body: {
      success: false,
      message: 'You have already flagged this review.',
    },
  });
});

test('FlagCollaborationReviewUseCase flags review and notifies admins', async () => {
  const calls = [];
  const updatedReview = { _id: 'review-1', status: 'flagged' };
  const useCase = new FlagCollaborationReviewUseCase({
    collaborationReviewGateway: {
      async findReviewForFlag(reviewId) {
        calls.push(['find', reviewId]);
        return {
          _id: reviewId,
          status: 'published',
          flags: [],
        };
      },
      async flagReview(command) {
        calls.push(['flag', command]);
        return updatedReview;
      },
      async getAdminNotificationRecipients() {
        calls.push(['admins']);
        return [{ _id: 'admin-1' }, { _id: 'admin-2' }];
      },
      async notifyReviewFlagged(adminId, review, reason) {
        calls.push(['notify', adminId, review, reason]);
      },
    },
  });

  const result = await useCase.execute(FlagCollaborationReviewDto.fromRequest({
    user: { _id: 'user-1' },
    params: { reviewId: 'review-1' },
    body: { reason: 'Suspicious', details: 'Looks copied' },
  }));

  assert.deepEqual(calls, [
    ['find', 'review-1'],
    ['flag', {
      reviewId: 'review-1',
      userId: 'user-1',
      reason: 'Suspicious',
      details: 'Looks copied',
      currentStatus: 'published',
    }],
    ['admins'],
    ['notify', 'admin-1', updatedReview, 'Suspicious'],
    ['notify', 'admin-2', updatedReview, 'Suspicious'],
  ]);
  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      data: updatedReview,
      message: 'Review flagged for moderation.',
    },
  });
});

test('ModerateCollaborationReviewUseCase preserves not-found and invalid action responses', async () => {
  const missingUseCase = new ModerateCollaborationReviewUseCase({
    collaborationReviewGateway: {
      async findReviewById() {
        return null;
      },
    },
  });

  assert.deepEqual(await missingUseCase.execute(new ModerateCollaborationReviewDto({
    reviewId: 'missing',
    body: { action: 'hide' },
  })), {
    statusCode: 404,
    body: {
      success: false,
      message: 'Review not found.',
    },
  });

  const invalidUseCase = new ModerateCollaborationReviewUseCase({
    collaborationReviewGateway: {
      async findReviewById() {
        return { _id: 'review-1', reviewee: 'reviewee-1' };
      },
    },
  });

  assert.deepEqual(await invalidUseCase.execute(new ModerateCollaborationReviewDto({
    reviewId: 'review-1',
    body: { action: 'unknown' },
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Unknown moderation action.',
    },
  });
});

test('ModerateCollaborationReviewUseCase updates moderation state and recomputes rating', async () => {
  const calls = [];
  const updatedReview = { _id: 'review-1', status: 'hidden' };
  const useCase = new ModerateCollaborationReviewUseCase({
    collaborationReviewGateway: {
      async findReviewById(reviewId) {
        calls.push(['find', reviewId]);
        return {
          _id: reviewId,
          reviewee: 'reviewee-1',
        };
      },
      async updateReviewModeration(command) {
        calls.push(['update', {
          reviewId: command.reviewId,
          status: command.update.status,
          hiddenAtIsDate: command.update.hiddenAt instanceof Date,
          moderationNotes: command.update.moderationNotes,
          adminResponse: command.update.adminResponse,
          moderatedBy: command.update.moderatedBy,
        }]);
        return updatedReview;
      },
      async recomputeCollaborationRating(userId) {
        calls.push(['recompute', userId]);
      },
    },
  });

  const result = await useCase.execute(ModerateCollaborationReviewDto.fromRequest({
    user: { _id: 'admin-1' },
    params: { reviewId: 'review-1' },
    body: {
      action: 'hide',
      note: ' Needs review ',
      response: ' Admin response ',
    },
  }));

  assert.deepEqual(calls, [
    ['find', 'review-1'],
    ['update', {
      reviewId: 'review-1',
      status: 'hidden',
      hiddenAtIsDate: true,
      moderationNotes: 'Needs review',
      adminResponse: 'Admin response',
      moderatedBy: 'admin-1',
    }],
    ['recompute', 'reviewee-1'],
  ]);
  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      data: updatedReview,
      message: 'Review moderation updated.',
    },
  });
});
