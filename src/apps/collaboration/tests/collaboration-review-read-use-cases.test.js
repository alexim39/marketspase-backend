import test from 'node:test';
import assert from 'node:assert/strict';

import { GetReviewEligibilityDto } from '../application/dto/get-review-eligibility.dto.js';
import { ListAdminReviewsDto } from '../application/dto/list-admin-reviews.dto.js';
import { ListGivenReviewsDto } from '../application/dto/list-given-reviews.dto.js';
import { ListReceivedReviewsDto } from '../application/dto/list-received-reviews.dto.js';
import { GetReviewEligibilityUseCase } from '../application/use-cases/get-review-eligibility.use-case.js';
import { ListAdminReviewsUseCase } from '../application/use-cases/list-admin-reviews.use-case.js';
import { ListGivenReviewsUseCase } from '../application/use-cases/list-given-reviews.use-case.js';
import { ListReceivedReviewsUseCase } from '../application/use-cases/list-received-reviews.use-case.js';

test('GetReviewEligibilityUseCase preserves eligibility response shape and arguments', async () => {
  let gatewayQuery = null;
  const eligibility = {
    eligible: true,
    relationshipType: 'marketer_to_promoter',
  };

  const useCase = new GetReviewEligibilityUseCase({
    collaborationReviewGateway: {
      async getReviewEligibility(query) {
        gatewayQuery = query;
        return eligibility;
      },
    },
  });

  const result = await useCase.execute(GetReviewEligibilityDto.fromRequest({
    user: { _id: 'reviewer-1' },
    params: { targetUserId: 'reviewee-1' },
    query: { promotionId: 'promotion-1' },
  }));

  assert.deepEqual(gatewayQuery, {
    reviewerId: 'reviewer-1',
    revieweeId: 'reviewee-1',
    promotionId: 'promotion-1',
  });
  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      data: eligibility,
    },
  });
});

test('ListReceivedReviewsUseCase preserves invalid ID guard and hidden review option', async () => {
  const useCase = new ListReceivedReviewsUseCase({
    collaborationReviewGateway: {
      isValidObjectId(value) {
        return value === 'valid-user';
      },
      async listReceivedReviews(query) {
        assert.deepEqual(query, {
          userId: 'valid-user',
          page: 2,
          limit: 50,
          includeHidden: true,
        });

        return {
          reviews: [{ _id: 'review-1' }],
          pagination: {
            total: 1,
            page: 2,
            limit: 50,
            totalPages: 1,
          },
          summary: {
            averageRating: 4.5,
            totalReviews: 1,
            flagged: 0,
          },
        };
      },
    },
  });

  assert.deepEqual(await useCase.execute(new ListReceivedReviewsDto({
    userId: 'invalid-user',
    query: {},
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Invalid user ID.',
    },
  });

  const result = await useCase.execute(ListReceivedReviewsDto.fromRequest({
    user: { role: 'admin' },
    params: { userId: 'valid-user' },
    query: { page: '2', limit: '200', includeHidden: 'true' },
  }));

  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      data: [{ _id: 'review-1' }],
      pagination: {
        total: 1,
        page: 2,
        limit: 50,
        totalPages: 1,
      },
      summary: {
        averageRating: 4.5,
        totalReviews: 1,
        flagged: 0,
      },
    },
  });
});

test('ListGivenReviewsUseCase preserves authored review pagination contract', async () => {
  const useCase = new ListGivenReviewsUseCase({
    collaborationReviewGateway: {
      isValidObjectId(value) {
        return value === 'valid-user';
      },
      async listGivenReviews(query) {
        assert.deepEqual(query, {
          userId: 'valid-user',
          page: 1,
          limit: 12,
        });

        return {
          reviews: [{ _id: 'review-2' }],
          pagination: {
            total: 1,
            page: 1,
            limit: 12,
            totalPages: 1,
          },
        };
      },
    },
  });

  const result = await useCase.execute(ListGivenReviewsDto.fromRequest({
    params: { userId: 'valid-user' },
    query: { page: '-2', limit: '0' },
  }));

  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      data: [{ _id: 'review-2' }],
      pagination: {
        total: 1,
        page: 1,
        limit: 12,
        totalPages: 1,
      },
    },
  });
});

test('ListAdminReviewsUseCase preserves admin filter parsing and response shape', async () => {
  const useCase = new ListAdminReviewsUseCase({
    collaborationReviewGateway: {
      async listAdminReviews(query) {
        assert.deepEqual(query, {
          page: 3,
          limit: 20,
          search: 'late proof',
          status: 'flagged',
          flaggedOnly: true,
        });

        return {
          reviews: [{ _id: 'review-3' }],
          pagination: {
            total: 1,
            page: 3,
            limit: 20,
            totalPages: 1,
          },
          summary: {
            totalReviews: 10,
            published: 6,
            flagged: 2,
            hidden: 1,
            removed: 1,
          },
        };
      },
    },
  });

  const result = await useCase.execute(ListAdminReviewsDto.fromRequest({
    query: {
      page: '3',
      limit: '20',
      search: ' late proof ',
      status: 'flagged',
      flaggedOnly: 'true',
    },
  }));

  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      data: [{ _id: 'review-3' }],
      pagination: {
        total: 1,
        page: 3,
        limit: 20,
        totalPages: 1,
      },
      summary: {
        totalReviews: 10,
        published: 6,
        flagged: 2,
        hidden: 1,
        removed: 1,
      },
    },
  });
});

test('Collaboration review read use cases let gateway errors propagate to controller failure paths', async () => {
  const useCase = new ListAdminReviewsUseCase({
    collaborationReviewGateway: {
      async listAdminReviews() {
        throw new Error('review query failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new ListAdminReviewsDto()),
    /review query failed/,
  );
});
