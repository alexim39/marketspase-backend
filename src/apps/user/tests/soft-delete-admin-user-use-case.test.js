import test from 'node:test';
import assert from 'node:assert/strict';

import { SoftDeleteAdminUserDto } from '../application/dto/soft-delete-admin-user.dto.js';
import { SoftDeleteAdminUserUseCase } from '../application/use-cases/soft-delete-admin-user.use-case.js';

test('SoftDeleteAdminUserUseCase preserves invalid user ID response', async () => {
  const useCase = new SoftDeleteAdminUserUseCase({
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

  assert.deepEqual(await useCase.execute(new SoftDeleteAdminUserDto({
    userId: 'bad-id',
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Invalid user ID format',
    },
  });
});

test('SoftDeleteAdminUserUseCase preserves missing user response', async () => {
  const useCase = new SoftDeleteAdminUserUseCase({
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

  assert.deepEqual(await useCase.execute(SoftDeleteAdminUserDto.fromRequest({
    params: { id: 'user-1' },
  })), {
    statusCode: 404,
    body: {
      success: false,
      message: 'User not found',
    },
  });
});

test('SoftDeleteAdminUserUseCase rejects already deleted users without saving', async () => {
  const useCase = new SoftDeleteAdminUserUseCase({
    adminUserLifecycleGateway: {
      isValidUserId() {
        return true;
      },
      async findUserById() {
        return {
          _id: 'user-1',
          isDeleted: true,
        };
      },
      async softDeleteUser() {
        throw new Error('should not soft delete twice');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new SoftDeleteAdminUserDto({
    userId: 'user-1',
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'User is already deleted',
    },
  });
});

test('SoftDeleteAdminUserUseCase soft deletes user and writes legacy activity log', async () => {
  const deletedAt = new Date('2026-05-20T15:00:00.000Z');
  const user = {
    _id: 'user-db-id',
    isDeleted: false,
  };
  const calls = [];
  const useCase = new SoftDeleteAdminUserUseCase({
    now: () => deletedAt,
    adminUserLifecycleGateway: {
      isValidUserId(userId) {
        calls.push(['isValidUserId', userId]);
        return true;
      },
      async findUserById(userId) {
        calls.push(['findUserById', userId]);
        return user;
      },
      async softDeleteUser(command) {
        calls.push(['softDeleteUser', command]);
        command.user.isDeleted = true;
        command.user.deletedAt = command.deletedAt;
        command.user.deletedBy = command.actorId;
        return command.user;
      },
      async logUserDeleted(command) {
        calls.push(['logUserDeleted', command]);
      },
    },
  });

  const result = await useCase.execute(SoftDeleteAdminUserDto.fromRequest({
    params: { id: 'user-1' },
    user: { _id: 'admin-1' },
  }));

  assert.deepEqual(calls, [
    ['isValidUserId', 'user-1'],
    ['findUserById', 'user-1'],
    ['softDeleteUser', {
      user: {
        _id: 'user-db-id',
        isDeleted: true,
        deletedAt,
        deletedBy: 'admin-1',
      },
      actorId: 'admin-1',
      deletedAt,
    }],
    ['logUserDeleted', {
      user: {
        _id: 'user-db-id',
        isDeleted: true,
        deletedAt,
        deletedBy: 'admin-1',
      },
      actorId: 'admin-1',
      deletedAt,
    }],
  ]);
  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      message: 'User deleted successfully',
      data: {
        _id: 'user-db-id',
        isDeleted: true,
        deletedAt,
      },
    },
  });
});

test('SoftDeleteAdminUserUseCase lets gateway errors propagate to controller failure paths', async () => {
  const useCase = new SoftDeleteAdminUserUseCase({
    adminUserLifecycleGateway: {
      isValidUserId() {
        return true;
      },
      async findUserById() {
        throw new Error('soft delete lookup failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new SoftDeleteAdminUserDto({
      userId: 'user-1',
    })),
    /soft delete lookup failed/,
  );
});
