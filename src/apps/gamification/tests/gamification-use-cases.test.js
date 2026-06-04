import test from 'node:test';
import assert from 'node:assert/strict';

import { GetGamificationDashboardDto } from '../application/dto/get-gamification-dashboard.dto.js';
import { GetGamificationFeedDto } from '../application/dto/get-gamification-feed.dto.js';
import { UpdateAdminGamificationConfigDto } from '../application/dto/update-admin-gamification-config.dto.js';
import { GetAdminGamificationConfigUseCase } from '../application/use-cases/get-admin-gamification-config.use-case.js';
import { GetGamificationDashboardUseCase } from '../application/use-cases/get-gamification-dashboard.use-case.js';
import { GetGamificationFeedUseCase } from '../application/use-cases/get-gamification-feed.use-case.js';
import { UpdateAdminGamificationConfigUseCase } from '../application/use-cases/update-admin-gamification-config.use-case.js';

test('GetGamificationDashboardUseCase preserves the legacy dashboard user argument', async () => {
  let gatewayUserId = null;
  const response = {
    success: true,
    data: {
      enabled: true,
      gamificationProfile: {
        currentLevel: 2,
        totalExperiencePoints: 120,
      },
    },
  };

  const useCase = new GetGamificationDashboardUseCase({
    gamificationQueryGateway: {
      async getGamificationDashboard(userId) {
        gatewayUserId = userId;
        return response;
      },
    },
  });

  const result = await useCase.execute(
    GetGamificationDashboardDto.fromRequest({ userId: 'user-1' }),
  );

  assert.deepEqual(result, response);
  assert.equal(gatewayUserId, 'user-1');
});

test('GetGamificationFeedUseCase preserves the legacy feed user argument', async () => {
  let gatewayUserId = null;
  const response = {
    success: true,
    data: {
      enabled: true,
      recentCelebrations: [],
    },
  };

  const useCase = new GetGamificationFeedUseCase({
    gamificationQueryGateway: {
      async getGamificationFeed(userId) {
        gatewayUserId = userId;
        return response;
      },
    },
  });

  const result = await useCase.execute(
    GetGamificationFeedDto.fromRequest({ userId: 'user-1' }),
  );

  assert.deepEqual(result, response);
  assert.equal(gatewayUserId, 'user-1');
});

test('GetAdminGamificationConfigUseCase preserves the legacy admin config response', async () => {
  const response = {
    success: true,
    data: {
      config: {
        enabled: true,
        refreshIntervalMinutes: 15,
      },
      actionCatalog: [],
      categories: [],
      roles: [],
    },
  };

  const useCase = new GetAdminGamificationConfigUseCase({
    gamificationAdminConfigGateway: {
      async getAdminGamificationConfig() {
        return response;
      },
    },
  });

  assert.deepEqual(await useCase.execute(), response);
});

test('UpdateAdminGamificationConfigUseCase preserves admin id and payload arguments', async () => {
  let gatewayArgs = null;
  const response = {
    success: true,
    data: {
      config: {
        enabled: false,
        refreshIntervalMinutes: 30,
      },
    },
  };

  const useCase = new UpdateAdminGamificationConfigUseCase({
    gamificationAdminConfigGateway: {
      async updateAdminGamificationConfig(adminId, payload) {
        gatewayArgs = { adminId, payload };
        return response;
      },
    },
  });

  const result = await useCase.execute(
    UpdateAdminGamificationConfigDto.fromRequest({
      adminId: 'admin-1',
      body: {
        enabled: false,
        refreshIntervalMinutes: '30',
        actionRules: [
          { actionKey: 'login_qualified', experiencePoints: 8 },
        ],
      },
    }),
  );

  assert.deepEqual(result, response);
  assert.deepEqual(gatewayArgs, {
    adminId: 'admin-1',
    payload: {
      enabled: false,
      refreshIntervalMinutes: '30',
      actionRules: [
        { actionKey: 'login_qualified', experiencePoints: 8 },
      ],
    },
  });
});

test('Gamification use cases let gateway errors propagate to controller failure paths', async () => {
  const useCase = new GetGamificationDashboardUseCase({
    gamificationQueryGateway: {
      async getGamificationDashboard() {
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
