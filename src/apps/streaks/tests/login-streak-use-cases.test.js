import test from 'node:test';
import assert from 'node:assert/strict';

import { GetLoginStreakLeaderboardDto } from '../application/dto/get-login-streak-leaderboard.dto.js';
import { GetLoginStreakStatusDto } from '../application/dto/get-login-streak-status.dto.js';
import { UpdateAdminLoginStreakConfigDto } from '../application/dto/update-admin-login-streak-config.dto.js';
import { GetAdminLoginStreakConfigUseCase } from '../application/use-cases/get-admin-login-streak-config.use-case.js';
import { GetLoginStreakLeaderboardUseCase } from '../application/use-cases/get-login-streak-leaderboard.use-case.js';
import { GetLoginStreakStatusUseCase } from '../application/use-cases/get-login-streak-status.use-case.js';
import { UpdateAdminLoginStreakConfigUseCase } from '../application/use-cases/update-admin-login-streak-config.use-case.js';

test('GetLoginStreakStatusUseCase preserves the legacy status user argument', async () => {
  let gatewayUserId = null;
  const response = {
    success: true,
    data: {
      enabled: true,
      currentStreak: 3,
      qualifiedToday: false,
    },
  };

  const useCase = new GetLoginStreakStatusUseCase({
    loginStreakQueryGateway: {
      async getLoginStreakStatus(userId) {
        gatewayUserId = userId;
        return response;
      },
    },
  });

  const result = await useCase.execute(
    GetLoginStreakStatusDto.fromRequest({ userId: 'user-1' }),
  );

  assert.deepEqual(result, response);
  assert.equal(gatewayUserId, 'user-1');
});

test('GetLoginStreakLeaderboardUseCase preserves current user and query arguments', async () => {
  let gatewayArgs = null;
  const response = {
    success: true,
    data: {
      enabled: true,
      timeframe: 'weekly',
      metric: 'points',
      entries: [],
    },
  };

  const useCase = new GetLoginStreakLeaderboardUseCase({
    loginStreakQueryGateway: {
      async getLeaderboard(currentUserId, query) {
        gatewayArgs = { currentUserId, query };
        return response;
      },
    },
  });

  const result = await useCase.execute(
    GetLoginStreakLeaderboardDto.fromRequest({
      userId: 'user-1',
      query: {
        timeframe: 'weekly',
        metric: 'points',
        limit: '20',
      },
    }),
  );

  assert.deepEqual(result, response);
  assert.deepEqual(gatewayArgs, {
    currentUserId: 'user-1',
    query: {
      timeframe: 'weekly',
      metric: 'points',
      limit: '20',
    },
  });
});

test('GetAdminLoginStreakConfigUseCase preserves the legacy admin config response', async () => {
  const response = {
    success: true,
    data: {
      enabled: true,
      timezone: 'Africa/Lagos',
      minimumSessionMinutes: 12,
      leaderboard: {
        enabled: true,
      },
    },
  };

  const useCase = new GetAdminLoginStreakConfigUseCase({
    loginStreakAdminConfigGateway: {
      async getAdminLoginStreakConfig() {
        return response;
      },
    },
  });

  assert.deepEqual(await useCase.execute(), response);
});

test('UpdateAdminLoginStreakConfigUseCase preserves admin id and payload arguments', async () => {
  let gatewayArgs = null;
  const response = {
    success: true,
    data: {
      enabled: false,
      minimumSessionMinutes: 15,
    },
  };

  const useCase = new UpdateAdminLoginStreakConfigUseCase({
    loginStreakAdminConfigGateway: {
      async updateAdminLoginStreakConfig(adminId, payload) {
        gatewayArgs = { adminId, payload };
        return response;
      },
    },
  });

  const result = await useCase.execute(
    UpdateAdminLoginStreakConfigDto.fromRequest({
      adminId: 'admin-1',
      body: {
        enabled: false,
        minimumSessionMinutes: '15',
        leaderboard: {
          defaultMetric: 'points',
        },
      },
    }),
  );

  assert.deepEqual(result, response);
  assert.deepEqual(gatewayArgs, {
    adminId: 'admin-1',
    payload: {
      enabled: false,
      minimumSessionMinutes: '15',
      leaderboard: {
        defaultMetric: 'points',
      },
    },
  });
});

test('Login streak use cases let gateway errors propagate to controller failure paths', async () => {
  const useCase = new GetLoginStreakStatusUseCase({
    loginStreakQueryGateway: {
      async getLoginStreakStatus() {
        throw new Error('User not found');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ userId: 'missing-user' }),
    /User not found/,
  );
});
