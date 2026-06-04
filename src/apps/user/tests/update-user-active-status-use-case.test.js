import test from 'node:test';
import assert from 'node:assert/strict';

import { UpdateUserActiveStatusDto } from '../application/dto/update-user-active-status.dto.js';
import { UpdateUserActiveStatusUseCase } from '../application/use-cases/update-user-active-status.use-case.js';

test('UpdateUserActiveStatusUseCase preserves boolean validation before ID validation', async () => {
  const useCase = new UpdateUserActiveStatusUseCase({
    adminUserStatusGateway: {
      isValidUserId() {
        throw new Error('should not validate user ID');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdateUserActiveStatusDto({
    userId: 'bad-id',
    isActive: 'false',
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'isActive must be a boolean value',
    },
  });
});

test('UpdateUserActiveStatusUseCase preserves invalid user ID response', async () => {
  const useCase = new UpdateUserActiveStatusUseCase({
    adminUserStatusGateway: {
      isValidUserId(userId) {
        assert.equal(userId, 'bad-id');
        return false;
      },
      async findUserById() {
        throw new Error('should not query user');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdateUserActiveStatusDto({
    userId: 'bad-id',
    isActive: false,
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Invalid user ID format',
    },
  });
});

test('UpdateUserActiveStatusUseCase preserves missing user response', async () => {
  const useCase = new UpdateUserActiveStatusUseCase({
    adminUserStatusGateway: {
      isValidUserId() {
        return true;
      },
      async findUserById(userId) {
        assert.equal(userId, 'user-1');
        return null;
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdateUserActiveStatusDto({
    userId: 'user-1',
    isActive: true,
  })), {
    statusCode: 404,
    body: {
      success: false,
      message: 'User not found',
    },
  });
});

test('UpdateUserActiveStatusUseCase rejects deleted users without saving', async () => {
  const useCase = new UpdateUserActiveStatusUseCase({
    adminUserStatusGateway: {
      isValidUserId() {
        return true;
      },
      async findUserById() {
        return {
          _id: 'user-1',
          isDeleted: true,
        };
      },
      async saveUserActiveStatus() {
        throw new Error('should not save deleted user');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdateUserActiveStatusDto({
    userId: 'user-1',
    isActive: false,
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Cannot update status of deleted user',
    },
  });
});

test('UpdateUserActiveStatusUseCase updates status and writes legacy activity log', async () => {
  const calls = [];
  const updatedAt = new Date('2026-05-20T15:00:00.000Z');
  const user = {
    _id: 'user-db-id',
    isDeleted: false,
    isActive: true,
    updatedAt,
  };
  const useCase = new UpdateUserActiveStatusUseCase({
    adminUserStatusGateway: {
      isValidUserId(userId) {
        calls.push(['isValidUserId', userId]);
        return true;
      },
      async findUserById(userId) {
        calls.push(['findUserById', userId]);
        return user;
      },
      async saveUserActiveStatus(command) {
        calls.push(['saveUserActiveStatus', command]);
        command.user.isActive = command.isActive;
        return command.user;
      },
      async logUserStatusChange(command) {
        calls.push(['logUserStatusChange', command]);
      },
    },
  });

  const result = await useCase.execute(UpdateUserActiveStatusDto.fromRequest({
    params: { id: 'user-1' },
    body: { isActive: false },
    user: { _id: 'admin-1' },
  }));

  assert.deepEqual(calls, [
    ['isValidUserId', 'user-1'],
    ['findUserById', 'user-1'],
    ['saveUserActiveStatus', {
      user: {
        _id: 'user-db-id',
        isDeleted: false,
        isActive: false,
        updatedAt,
      },
      isActive: false,
    }],
    ['logUserStatusChange', {
      user: {
        _id: 'user-db-id',
        isDeleted: false,
        isActive: false,
        updatedAt,
      },
      isActive: false,
      actorId: 'admin-1',
    }],
  ]);
  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      message: 'User deactivated successfully',
      data: {
        _id: 'user-db-id',
        isActive: false,
        updatedAt,
      },
    },
  });
});

test('UpdateUserActiveStatusUseCase lets gateway errors propagate to controller failure paths', async () => {
  const useCase = new UpdateUserActiveStatusUseCase({
    adminUserStatusGateway: {
      isValidUserId() {
        return true;
      },
      async findUserById() {
        throw new Error('status lookup failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new UpdateUserActiveStatusDto({
      userId: 'user-1',
      isActive: true,
    })),
    /status lookup failed/,
  );
});
