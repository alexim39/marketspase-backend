import test from 'node:test';
import assert from 'node:assert/strict';

import { GetAdminUserDetailDto } from '../application/dto/get-admin-user-detail.dto.js';
import { GetAdminUserDetailUseCase } from '../application/use-cases/get-admin-user-detail.use-case.js';

test('GetAdminUserDetailUseCase preserves invalid user ID response', async () => {
  const useCase = new GetAdminUserDetailUseCase({
    adminUserDetailGateway: {
      isValidUserId(userId) {
        assert.equal(userId, 'bad-id');
        return false;
      },
      async findUserDetailById() {
        throw new Error('should not query user detail');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new GetAdminUserDetailDto({
    userId: 'bad-id',
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Invalid user ID format',
    },
  });
});

test('GetAdminUserDetailUseCase preserves missing user response', async () => {
  const useCase = new GetAdminUserDetailUseCase({
    adminUserDetailGateway: {
      isValidUserId() {
        return true;
      },
      async findUserDetailById(userId) {
        assert.equal(userId, 'user-1');
        return null;
      },
    },
  });

  assert.deepEqual(await useCase.execute(GetAdminUserDetailDto.fromRequest({
    params: { id: 'user-1' },
  })), {
    statusCode: 404,
    body: {
      success: false,
      message: 'User not found',
    },
  });
});

test('GetAdminUserDetailUseCase preserves deleted user response', async () => {
  const useCase = new GetAdminUserDetailUseCase({
    adminUserDetailGateway: {
      isValidUserId() {
        return true;
      },
      async findUserDetailById() {
        return {
          _id: 'user-1',
          isDeleted: true,
        };
      },
    },
  });

  assert.deepEqual(await useCase.execute(new GetAdminUserDetailDto({
    userId: 'user-1',
  })), {
    statusCode: 404,
    body: {
      success: false,
      message: 'User has been deleted',
    },
  });
});

test('GetAdminUserDetailUseCase returns the legacy successful detail response', async () => {
  const user = {
    _id: 'user-1',
    username: 'ada',
    email: 'ada@example.com',
    role: 'marketer',
    isDeleted: false,
  };
  const calls = [];
  const useCase = new GetAdminUserDetailUseCase({
    adminUserDetailGateway: {
      isValidUserId(userId) {
        calls.push(['isValidUserId', userId]);
        return true;
      },
      async findUserDetailById(userId) {
        calls.push(['findUserDetailById', userId]);
        return user;
      },
    },
  });

  assert.deepEqual(await useCase.execute(new GetAdminUserDetailDto({
    userId: 'user-1',
  })), {
    statusCode: 200,
    body: {
      success: true,
      message: 'User fetched successfully',
      data: user,
    },
  });
  assert.deepEqual(calls, [
    ['isValidUserId', 'user-1'],
    ['findUserDetailById', 'user-1'],
  ]);
});

test('GetAdminUserDetailUseCase lets gateway errors propagate to controller failure paths', async () => {
  const useCase = new GetAdminUserDetailUseCase({
    adminUserDetailGateway: {
      isValidUserId() {
        return true;
      },
      async findUserDetailById() {
        throw new Error('admin user detail lookup failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new GetAdminUserDetailDto({
      userId: 'user-1',
    })),
    /admin user detail lookup failed/,
  );
});
