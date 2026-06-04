import test from 'node:test';
import assert from 'node:assert/strict';

import { UpdateUsernameDto } from '../application/dto/update-username.dto.js';
import { UpdateUsernameUseCase } from '../application/use-cases/update-username.use-case.js';

test('UpdateUsernameUseCase preserves missing username or user ID response', async () => {
  const useCase = new UpdateUsernameUseCase({
    usernameGateway: {},
  });

  assert.deepEqual(await useCase.execute(new UpdateUsernameDto({
    userId: 'user-1',
    body: { username: '   ' },
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Username and user ID are required.',
    },
  });

  assert.deepEqual(await useCase.execute(new UpdateUsernameDto({
    body: { username: 'ada' },
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Username and user ID are required.',
    },
  });
});

test('UpdateUsernameUseCase preserves invalid username response', async () => {
  const useCase = new UpdateUsernameUseCase({
    usernameGateway: {
      async updateUsername() {
        throw new Error('should not update invalid username');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdateUsernameDto({
    userId: 'user-1',
    body: { username: 'bad-name!' },
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Username can only contain letters, numbers, and underscores.',
    },
  });
});

test('UpdateUsernameUseCase preserves missing user and duplicate username responses', async () => {
  const useCase = new UpdateUsernameUseCase({
    usernameGateway: {
      async updateUsername({ username }) {
        return { status: username === 'missing' ? 'not-found' : 'duplicate' };
      },
      async logUsernameUpdate() {
        throw new Error('should not log failed updates');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdateUsernameDto({
    userId: 'user-1',
    body: { username: 'missing' },
  })), {
    statusCode: 404,
    body: {
      success: false,
      message: 'User not found.',
    },
  });

  assert.deepEqual(await useCase.execute(new UpdateUsernameDto({
    userId: 'user-1',
    body: { username: 'taken' },
  })), {
    statusCode: 409,
    body: {
      success: false,
      message: 'Username is already in use by another user.',
    },
  });
});

test('UpdateUsernameUseCase updates username, referral code, and logs activity', async () => {
  const calls = [];
  const user = { _id: 'user-1' };
  const useCase = new UpdateUsernameUseCase({
    usernameGateway: {
      async updateUsername(command) {
        calls.push(['update', command]);
        return {
          status: 'updated',
          user,
        };
      },
      async logUsernameUpdate(command) {
        calls.push(['log', command]);
      },
    },
  });

  const result = await useCase.execute(UpdateUsernameDto.fromRequest({
    userId: 'user-1',
    body: { username: ' ada_new ' },
  }));

  assert.deepEqual(calls, [
    ['update', {
      userId: 'user-1',
      username: 'ada_new',
    }],
    ['log', {
      user,
      username: 'ada_new',
    }],
  ]);
  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      message: 'Username updated successfully!',
    },
  });
});

test('UpdateUsernameUseCase lets gateway errors propagate to controller failure paths', async () => {
  const useCase = new UpdateUsernameUseCase({
    usernameGateway: {
      async updateUsername() {
        throw new Error('username update failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new UpdateUsernameDto({
      userId: 'user-1',
      body: { username: 'ada' },
    })),
    /username update failed/,
  );
});
