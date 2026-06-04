import test from 'node:test';
import assert from 'node:assert/strict';

import { UpdateAdminUserDisplayNameDto } from '../application/dto/update-admin-user-display-name.dto.js';
import { UpdateAdminUserDisplayNameUseCase } from '../application/use-cases/update-admin-user-display-name.use-case.js';

test('UpdateAdminUserDisplayNameUseCase preserves required display name validation before ID validation', async () => {
  const useCase = new UpdateAdminUserDisplayNameUseCase({
    adminUserDisplayNameGateway: {
      isValidUserId() {
        throw new Error('should not validate user ID');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdateAdminUserDisplayNameDto({
    userId: 'bad-id',
    displayName: '   ',
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Display name is required',
    },
  });
});

test('UpdateAdminUserDisplayNameUseCase preserves display name length validation', async () => {
  const useCase = new UpdateAdminUserDisplayNameUseCase({
    adminUserDisplayNameGateway: {
      isValidUserId() {
        throw new Error('should not validate user ID');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdateAdminUserDisplayNameDto({
    userId: 'user-1',
    displayName: 'A',
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Display name must be between 2 and 50 characters',
    },
  });
});

test('UpdateAdminUserDisplayNameUseCase preserves display name format validation', async () => {
  const useCase = new UpdateAdminUserDisplayNameUseCase({
    adminUserDisplayNameGateway: {
      isValidUserId() {
        throw new Error('should not validate user ID');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdateAdminUserDisplayNameDto({
    userId: 'user-1',
    displayName: 'Ada <> Lovelace',
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Display name can only contain letters, numbers, spaces, hyphens, and underscores',
    },
  });
});

test('UpdateAdminUserDisplayNameUseCase preserves invalid user ID response', async () => {
  const useCase = new UpdateAdminUserDisplayNameUseCase({
    adminUserDisplayNameGateway: {
      isValidUserId(userId) {
        assert.equal(userId, 'bad-id');
        return false;
      },
      async updateDisplayName() {
        throw new Error('should not update user');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdateAdminUserDisplayNameDto({
    userId: 'bad-id',
    displayName: 'Ada Lovelace',
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Invalid user ID format',
    },
  });
});

test('UpdateAdminUserDisplayNameUseCase preserves missing user response', async () => {
  const useCase = new UpdateAdminUserDisplayNameUseCase({
    adminUserDisplayNameGateway: {
      isValidUserId() {
        return true;
      },
      async updateDisplayName(command) {
        assert.deepEqual(command, {
          userId: 'user-1',
          displayName: 'Ada Lovelace',
        });
        return null;
      },
      async logDisplayNameUpdate() {
        throw new Error('should not log missing user');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdateAdminUserDisplayNameDto({
    userId: 'user-1',
    displayName: ' Ada Lovelace ',
  })), {
    statusCode: 404,
    body: {
      success: false,
      message: 'User not found',
    },
  });
});

test('UpdateAdminUserDisplayNameUseCase updates display name and writes legacy activity log', async () => {
  const calls = [];
  const user = {
    _id: 'user-db-id',
    displayName: 'Ada Lovelace',
  };

  const useCase = new UpdateAdminUserDisplayNameUseCase({
    adminUserDisplayNameGateway: {
      isValidUserId(userId) {
        calls.push(['isValidUserId', userId]);
        return true;
      },
      async updateDisplayName(command) {
        calls.push(['updateDisplayName', command]);
        return user;
      },
      async logDisplayNameUpdate(command) {
        calls.push(['logDisplayNameUpdate', command]);
      },
    },
  });

  const result = await useCase.execute(UpdateAdminUserDisplayNameDto.fromRequest({
    params: { userId: 'user-1' },
    body: { displayName: ' Ada Lovelace ' },
    user: { _id: 'admin-1' },
    ip: '127.0.0.1',
    getHeader(headerName) {
      assert.equal(headerName, 'user-agent');
      return 'unit-test-agent';
    },
  }));

  assert.deepEqual(calls, [
    ['isValidUserId', 'user-1'],
    ['updateDisplayName', {
      userId: 'user-1',
      displayName: 'Ada Lovelace',
    }],
    ['logDisplayNameUpdate', {
      user,
      displayName: 'Ada Lovelace',
      actorId: 'admin-1',
      ipAddress: '127.0.0.1',
      userAgent: 'unit-test-agent',
    }],
  ]);

  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      data: user,
      message: 'Display name updated successfully',
    },
  });
});

test('UpdateAdminUserDisplayNameUseCase lets gateway errors propagate to controller failure paths', async () => {
  const useCase = new UpdateAdminUserDisplayNameUseCase({
    adminUserDisplayNameGateway: {
      isValidUserId() {
        return true;
      },
      async updateDisplayName() {
        throw new Error('display name update failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new UpdateAdminUserDisplayNameDto({
      userId: 'user-1',
      displayName: 'Ada Lovelace',
    })),
    /display name update failed/,
  );
});
