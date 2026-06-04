import test from 'node:test';
import assert from 'node:assert/strict';

import { UpdateAdminBadgeConfigDto } from '../application/dto/update-admin-badge-config.dto.js';
import { GetAdminBadgeConfigUseCase } from '../application/use-cases/get-admin-badge-config.use-case.js';
import { UpdateAdminBadgeConfigUseCase } from '../application/use-cases/update-admin-badge-config.use-case.js';

test('GetAdminBadgeConfigUseCase preserves the legacy admin config response', async () => {
  const response = {
    success: true,
    data: {
      config: {
        enabled: true,
        feedRefreshMinutes: 15,
      },
      definitions: [],
      metricCatalog: [],
      categories: [],
      roles: [],
    },
  };

  const useCase = new GetAdminBadgeConfigUseCase({
    badgeAdminConfigGateway: {
      async getAdminBadgeConfig() {
        return response;
      },
    },
  });

  assert.deepEqual(await useCase.execute(), response);
});

test('UpdateAdminBadgeConfigUseCase preserves admin id and payload arguments', async () => {
  let gatewayArgs = null;
  const response = {
    success: true,
    data: {
      config: {
        enabled: false,
        feedRefreshMinutes: 30,
      },
      definitions: [],
    },
  };

  const useCase = new UpdateAdminBadgeConfigUseCase({
    badgeAdminConfigGateway: {
      async updateAdminBadgeConfig(adminId, payload) {
        gatewayArgs = { adminId, payload };
        return response;
      },
    },
  });

  const result = await useCase.execute(
    UpdateAdminBadgeConfigDto.fromRequest({
      adminId: 'admin-1',
      body: {
        enabled: false,
        feedRefreshMinutes: '30',
        levelThresholds: [
          { level: 1, title: 'Starter', minExperiencePoints: 0 },
        ],
      },
    }),
  );

  assert.deepEqual(result, response);
  assert.deepEqual(gatewayArgs, {
    adminId: 'admin-1',
    payload: {
      enabled: false,
      feedRefreshMinutes: '30',
      levelThresholds: [
        { level: 1, title: 'Starter', minExperiencePoints: 0 },
      ],
    },
  });
});

test('Badge admin config use cases let gateway errors propagate to controller failure paths', async () => {
  const useCase = new UpdateAdminBadgeConfigUseCase({
    badgeAdminConfigGateway: {
      async updateAdminBadgeConfig() {
        throw new Error('Badge config unavailable');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ adminId: 'admin-1', payload: { enabled: true } }),
    /Badge config unavailable/,
  );
});
