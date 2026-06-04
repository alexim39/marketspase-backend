import test from 'node:test';
import assert from 'node:assert/strict';

import { GetLiveActivityFeedDto } from '../application/dto/get-live-activity-feed.dto.js';
import { GetUsersOnlineCountDto } from '../application/dto/get-users-online-count.dto.js';
import { GetLiveActivityFeedUseCase } from '../application/use-cases/get-live-activity-feed.use-case.js';
import { GetUsersOnlineCountUseCase } from '../application/use-cases/get-users-online-count.use-case.js';

test('GetUsersOnlineCountUseCase preserves the legacy online count response shape', async () => {
  const useCase = new GetUsersOnlineCountUseCase({
    dashboardActivityGateway: {
      async getUsersOnlineCount() {
        return 14;
      },
    },
  });

  const result = await useCase.execute(
    GetUsersOnlineCountDto.fromRequest({
      params: {},
    }),
  );

  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      count: 14,
    },
  });
});

test('GetUsersOnlineCountUseCase preserves the legacy unexpected userId param guard', async () => {
  const useCase = new GetUsersOnlineCountUseCase({
    dashboardActivityGateway: {
      async getUsersOnlineCount() {
        assert.fail('gateway should not run when userId param is present');
      },
    },
  });

  const result = await useCase.execute({
    params: {
      userId: 'user-1',
    },
  });

  assert.deepEqual(result, {
    statusCode: 401,
    body: {
      success: false,
    },
  });
});

test('GetLiveActivityFeedUseCase preserves query forwarding and response shape', async () => {
  let gatewayQuery = null;
  const data = {
    activities: [
      {
        id: 'feed:1',
        type: 'post',
      },
    ],
    summary: {
      feedPosts24h: 1,
      forumThreads24h: 0,
      campaigns24h: 0,
      products24h: 0,
      total24h: 1,
    },
    refreshedAt: '2026-06-04T00:00:00.000Z',
  };

  const useCase = new GetLiveActivityFeedUseCase({
    dashboardActivityGateway: {
      async getLiveActivityFeed(query) {
        gatewayQuery = query;
        return data;
      },
    },
  });

  const result = await useCase.execute(
    GetLiveActivityFeedDto.fromRequest({
      query: {
        limit: '20',
      },
    }),
  );

  assert.deepEqual(result, {
    success: true,
    data,
  });
  assert.deepEqual(gatewayQuery, {
    limit: '20',
  });
});

test('Dashboard activity use cases let gateway errors propagate to controller failure paths', async () => {
  const useCase = new GetLiveActivityFeedUseCase({
    dashboardActivityGateway: {
      async getLiveActivityFeed() {
        throw new Error('Activity unavailable');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ query: {} }),
    /Activity unavailable/,
  );
});
