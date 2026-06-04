import test from 'node:test';
import assert from 'node:assert/strict';

import { CreateBadgeDefinitionDto } from '../application/dto/create-badge-definition.dto.js';
import { DeleteBadgeDefinitionDto } from '../application/dto/delete-badge-definition.dto.js';
import { UpdateBadgeDefinitionDto } from '../application/dto/update-badge-definition.dto.js';
import { CreateBadgeDefinitionUseCase } from '../application/use-cases/create-badge-definition.use-case.js';
import { DeleteBadgeDefinitionUseCase } from '../application/use-cases/delete-badge-definition.use-case.js';
import { UpdateBadgeDefinitionUseCase } from '../application/use-cases/update-badge-definition.use-case.js';

test('CreateBadgeDefinitionUseCase preserves admin id, payload, and response shape', async () => {
  let gatewayArgs = null;
  const response = {
    success: true,
    message: 'Badge created successfully.',
    data: {
      id: 'badge-1',
      key: 'sales-10',
      title: 'Sales Starter',
    },
  };

  const useCase = new CreateBadgeDefinitionUseCase({
    badgeDefinitionGateway: {
      async createBadgeDefinition(adminId, payload) {
        gatewayArgs = { adminId, payload };
        return response;
      },
    },
  });

  const result = await useCase.execute(
    CreateBadgeDefinitionDto.fromRequest({
      adminId: 'admin-1',
      body: {
        title: 'Sales Starter',
        description: 'Complete ten storefront sales.',
        criteria: {
          metric: 'store_orders_paid',
          targetValue: 10,
        },
      },
    }),
  );

  assert.deepEqual(result, response);
  assert.deepEqual(gatewayArgs, {
    adminId: 'admin-1',
    payload: {
      title: 'Sales Starter',
      description: 'Complete ten storefront sales.',
      criteria: {
        metric: 'store_orders_paid',
        targetValue: 10,
      },
    },
  });
});

test('UpdateBadgeDefinitionUseCase preserves admin id, badge id, payload, and response shape', async () => {
  let gatewayArgs = null;
  const response = {
    success: true,
    message: 'Badge updated successfully.',
    data: {
      id: 'badge-1',
      key: 'sales-10',
      title: 'Sales Builder',
    },
  };

  const useCase = new UpdateBadgeDefinitionUseCase({
    badgeDefinitionGateway: {
      async updateBadgeDefinition(adminId, badgeId, payload) {
        gatewayArgs = { adminId, badgeId, payload };
        return response;
      },
    },
  });

  const result = await useCase.execute(
    UpdateBadgeDefinitionDto.fromRequest({
      adminId: 'admin-1',
      badgeId: 'badge-1',
      body: {
        title: 'Sales Builder',
        isActive: true,
      },
    }),
  );

  assert.deepEqual(result, response);
  assert.deepEqual(gatewayArgs, {
    adminId: 'admin-1',
    badgeId: 'badge-1',
    payload: {
      title: 'Sales Builder',
      isActive: true,
    },
  });
});

test('DeleteBadgeDefinitionUseCase preserves admin id, badge id, and delete response shape', async () => {
  let gatewayArgs = null;
  const response = {
    success: true,
    message: 'Badge deleted successfully.',
  };

  const useCase = new DeleteBadgeDefinitionUseCase({
    badgeDefinitionGateway: {
      async deleteBadgeDefinition(adminId, badgeId) {
        gatewayArgs = { adminId, badgeId };
        return response;
      },
    },
  });

  const result = await useCase.execute(
    DeleteBadgeDefinitionDto.fromRequest({
      adminId: 'admin-1',
      badgeId: 'badge-1',
    }),
  );

  assert.deepEqual(result, response);
  assert.deepEqual(gatewayArgs, {
    adminId: 'admin-1',
    badgeId: 'badge-1',
  });
});

test('Badge definition use cases let gateway errors propagate to controller failure paths', async () => {
  const useCase = new UpdateBadgeDefinitionUseCase({
    badgeDefinitionGateway: {
      async updateBadgeDefinition() {
        const error = new Error('Badge definition not found.');
        error.status = 404;
        throw error;
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ adminId: 'admin-1', badgeId: 'missing-badge', payload: {} }),
    /Badge definition not found/,
  );
});
