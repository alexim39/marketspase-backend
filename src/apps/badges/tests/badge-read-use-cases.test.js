import test from 'node:test';
import assert from 'node:assert/strict';

import { GetBadgeOverviewDto } from '../application/dto/get-badge-overview.dto.js';
import { GetMyBadgeFeedDto } from '../application/dto/get-my-badge-feed.dto.js';
import { GetBadgeOverviewUseCase } from '../application/use-cases/get-badge-overview.use-case.js';
import { GetMyBadgeFeedUseCase } from '../application/use-cases/get-my-badge-feed.use-case.js';

test('GetMyBadgeFeedUseCase preserves the legacy badge feed arguments', async () => {
  let gatewayArgs = null;
  const response = {
    success: true,
    data: {
      enabled: true,
      recentUnlocks: [],
      nextBadges: [],
    },
  };

  const useCase = new GetMyBadgeFeedUseCase({
    badgeQueryGateway: {
      async getMyBadgeFeed(userId, query) {
        gatewayArgs = { userId, query };
        return response;
      },
    },
  });

  const result = await useCase.execute(
    GetMyBadgeFeedDto.fromRequest({
      userId: 'user-1',
      query: {
        limit: '12',
      },
    }),
  );

  assert.deepEqual(result, response);
  assert.deepEqual(gatewayArgs, {
    userId: 'user-1',
    query: {
      limit: '12',
    },
  });
});

test('GetBadgeOverviewUseCase preserves the legacy overview arguments', async () => {
  let gatewayArgs = null;
  const response = {
    success: true,
    data: {
      isOwner: true,
      earnedBadges: [],
      featuredBadges: [],
    },
  };

  const useCase = new GetBadgeOverviewUseCase({
    badgeQueryGateway: {
      async getUserBadgeOverview(viewerUserId, targetUserId) {
        gatewayArgs = { viewerUserId, targetUserId };
        return response;
      },
    },
  });

  const result = await useCase.execute(
    GetBadgeOverviewDto.fromRequest({
      viewerUserId: 'viewer-1',
      targetUserId: 'target-1',
    }),
  );

  assert.deepEqual(result, response);
  assert.deepEqual(gatewayArgs, {
    viewerUserId: 'viewer-1',
    targetUserId: 'target-1',
  });
});

test('Badge read use cases let gateway errors propagate to controller failure paths', async () => {
  const useCase = new GetMyBadgeFeedUseCase({
    badgeQueryGateway: {
      async getMyBadgeFeed() {
        const error = new Error('User not found');
        error.status = 404;
        throw error;
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ userId: 'missing-user' }),
    /User not found/,
  );
});
