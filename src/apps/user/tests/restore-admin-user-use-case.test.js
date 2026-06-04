import test from 'node:test';
import assert from 'node:assert/strict';

import { RestoreAdminUserDto } from '../application/dto/restore-admin-user.dto.js';
import { RestoreAdminUserUseCase } from '../application/use-cases/restore-admin-user.use-case.js';

test('RestoreAdminUserUseCase preserves invalid user ID response', async () => {
  const useCase = new RestoreAdminUserUseCase({
    adminUserLifecycleGateway: {
      isValidUserId(userId) {
        assert.equal(userId, 'bad-id');
        return false;
      },
      async findUserById() {
        throw new Error('should not query user');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new RestoreAdminUserDto({
    userId: 'bad-id',
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Invalid user ID format',
    },
  });
});

test('RestoreAdminUserUseCase preserves missing user response', async () => {
  const useCase = new RestoreAdminUserUseCase({
    adminUserLifecycleGateway: {
      isValidUserId() {
        return true;
      },
      async findUserById(userId) {
        assert.equal(userId, 'user-1');
        return null;
      },
    },
  });

  assert.deepEqual(await useCase.execute(RestoreAdminUserDto.fromRequest({
    params: { id: 'user-1' },
  })), {
    statusCode: 404,
    body: {
      success: false,
      message: 'User not found',
    },
  });
});

test('RestoreAdminUserUseCase rejects users that are not deleted without saving', async () => {
  const useCase = new RestoreAdminUserUseCase({
    adminUserLifecycleGateway: {
      isValidUserId() {
        return true;
      },
      async findUserById() {
        return {
          _id: 'user-1',
          isDeleted: false,
        };
      },
      async restoreUser() {
        throw new Error('should not restore active user');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new RestoreAdminUserDto({
    userId: 'user-1',
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'User is not deleted',
    },
  });
});

test('RestoreAdminUserUseCase restores user and writes legacy activity log', async () => {
  const user = {
    _id: 'user-db-id',
    isDeleted: true,
    deletedAt: new Date('2026-05-20T15:00:00.000Z'),
    deletedBy: 'admin-old',
  };
  const calls = [];
  const useCase = new RestoreAdminUserUseCase({
    adminUserLifecycleGateway: {
      isValidUserId(userId) {
        calls.push(['isValidUserId', userId]);
        return true;
      },
      async findUserById(userId) {
        calls.push(['findUserById', userId]);
        return user;
      },
      async restoreUser(command) {
        calls.push(['restoreUser', command]);
        command.user.isDeleted = false;
        command.user.deletedAt = undefined;
        command.user.deletedBy = undefined;
        return command.user;
      },
      async logUserRestored(command) {
        calls.push(['logUserRestored', command]);
      },
    },
  });

  const result = await useCase.execute(RestoreAdminUserDto.fromRequest({
    params: { id: 'user-1' },
    user: { _id: 'admin-1' },
  }));

  const restoredUser = {
    _id: 'user-db-id',
    isDeleted: false,
    deletedAt: undefined,
    deletedBy: undefined,
  };
  assert.deepEqual(calls, [
    ['isValidUserId', 'user-1'],
    ['findUserById', 'user-1'],
    ['restoreUser', { user: restoredUser }],
    ['logUserRestored', {
      user: restoredUser,
      actorId: 'admin-1',
    }],
  ]);
  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      message: 'User restored successfully',
      data: {
        _id: 'user-db-id',
        isDeleted: false,
      },
    },
  });
});

test('RestoreAdminUserUseCase lets gateway errors propagate to controller failure paths', async () => {
  const useCase = new RestoreAdminUserUseCase({
    adminUserLifecycleGateway: {
      isValidUserId() {
        return true;
      },
      async findUserById() {
        throw new Error('restore lookup failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new RestoreAdminUserDto({
      userId: 'user-1',
    })),
    /restore lookup failed/,
  );
});
