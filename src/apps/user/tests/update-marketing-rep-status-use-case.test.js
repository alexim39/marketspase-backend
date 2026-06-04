import test from 'node:test';
import assert from 'node:assert/strict';

import { UpdateMarketingRepStatusDto } from '../application/dto/update-marketing-rep-status.dto.js';
import { UpdateMarketingRepStatusUseCase } from '../application/use-cases/update-marketing-rep-status.use-case.js';

test('UpdateMarketingRepStatusUseCase promotes a user with the legacy response shape', async () => {
  const user = {
    _id: 'user-1',
    isMarketingRep: true,
  };
  const calls = [];
  const useCase = new UpdateMarketingRepStatusUseCase({
    adminMarketingRepGateway: {
      async updateMarketingRepStatus(command) {
        calls.push(command);
        return user;
      },
    },
  });

  assert.deepEqual(await useCase.execute(UpdateMarketingRepStatusDto.fromRequest({
    body: {
      userId: 'user-1',
      newValue: true,
    },
  })), {
    statusCode: 200,
    body: {
      success: true,
      message: 'User has been promoted to Marketing Rep status.',
      user,
    },
    meta: {
      userId: 'user-1',
      newValue: true,
    },
  });
  assert.deepEqual(calls, [{
    userId: 'user-1',
    updateData: {
      isMarketingRep: true,
    },
  }]);
});

test('UpdateMarketingRepStatusUseCase removes a marketing rep and resets role to promoter', async () => {
  const user = {
    _id: 'user-1',
    isMarketingRep: false,
    role: 'promoter',
  };
  const calls = [];
  const useCase = new UpdateMarketingRepStatusUseCase({
    adminMarketingRepGateway: {
      async updateMarketingRepStatus(command) {
        calls.push(command);
        return user;
      },
    },
  });

  const result = await useCase.execute(new UpdateMarketingRepStatusDto({
    userId: 'user-1',
    newValue: false,
  }));

  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      message: 'User has been removed from Marketing Rep status.',
      user,
    },
    meta: {
      userId: 'user-1',
      newValue: false,
    },
  });
  assert.deepEqual(calls, [{
    userId: 'user-1',
    updateData: {
      isMarketingRep: false,
      role: 'promoter',
    },
  }]);
});

test('UpdateMarketingRepStatusUseCase preserves not found response', async () => {
  const useCase = new UpdateMarketingRepStatusUseCase({
    adminMarketingRepGateway: {
      async updateMarketingRepStatus(command) {
        assert.deepEqual(command, {
          userId: 'missing-user',
          updateData: {
            isMarketingRep: true,
          },
        });
        return null;
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdateMarketingRepStatusDto({
    userId: 'missing-user',
    newValue: true,
  })), {
    statusCode: 404,
    body: {
      success: false,
      message: 'User not found',
    },
  });
});

test('UpdateMarketingRepStatusUseCase preserves legacy falsey missing value behavior', async () => {
  const calls = [];
  const useCase = new UpdateMarketingRepStatusUseCase({
    adminMarketingRepGateway: {
      async updateMarketingRepStatus(command) {
        calls.push(command);
        return {
          _id: null,
        };
      },
    },
  });

  const result = await useCase.execute(new UpdateMarketingRepStatusDto({
    userId: null,
  }));

  assert.deepEqual(calls, [{
    userId: null,
    updateData: {
      isMarketingRep: undefined,
      role: 'promoter',
    },
  }]);
  assert.deepEqual(result.body.message, 'User has been removed from Marketing Rep status.');
});

test('UpdateMarketingRepStatusUseCase lets gateway errors propagate to controller failure paths', async () => {
  const useCase = new UpdateMarketingRepStatusUseCase({
    adminMarketingRepGateway: {
      async updateMarketingRepStatus() {
        throw new Error('marketing rep update failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new UpdateMarketingRepStatusDto({
      userId: 'user-1',
      newValue: true,
    })),
    /marketing rep update failed/,
  );
});
