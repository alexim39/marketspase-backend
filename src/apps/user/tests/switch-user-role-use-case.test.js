import test from 'node:test';
import assert from 'node:assert/strict';

import { SwitchUserRoleDto } from '../application/dto/switch-user-role.dto.js';
import { SwitchUserRoleUseCase } from '../application/use-cases/switch-user-role.use-case.js';

test('SwitchUserRoleUseCase preserves missing authentication guard', async () => {
  const useCase = new SwitchUserRoleUseCase({
    userRoleGateway: {
      async findUserById() {
        throw new Error('should not query user');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new SwitchUserRoleDto({
    role: 'promoter',
  })), {
    statusCode: 401,
    body: {
      success: false,
      message: 'Authentication required.',
    },
  });
});

test('SwitchUserRoleUseCase preserves invalid target role response', async () => {
  const useCase = new SwitchUserRoleUseCase({
    userRoleGateway: {
      async findUserById() {
        throw new Error('should not query user');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new SwitchUserRoleDto({
    userId: 'user-1',
    role: 'admin',
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Invalid target role.',
    },
  });
});

test('SwitchUserRoleUseCase preserves missing user response', async () => {
  const useCase = new SwitchUserRoleUseCase({
    userRoleGateway: {
      async findUserById(userId) {
        assert.equal(userId, 'user-1');
        return null;
      },
    },
  });

  assert.deepEqual(await useCase.execute(new SwitchUserRoleDto({
    userId: 'user-1',
    role: 'marketer',
  })), {
    statusCode: 404,
    body: {
      success: false,
      message: 'User not found.',
    },
  });
});

test('SwitchUserRoleUseCase preserves unswitchable current role response', async () => {
  const useCase = new SwitchUserRoleUseCase({
    userRoleGateway: {
      async findUserById() {
        return {
          _id: 'user-1',
          username: 'ada',
          role: 'buyer',
        };
      },
      async updateUserRole() {
        throw new Error('should not update user');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new SwitchUserRoleDto({
    userId: 'user-1',
    role: 'marketer',
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: "User's current role 'buyer' cannot be switched.",
    },
  });
});

test('SwitchUserRoleUseCase updates role and writes legacy activity entry', async () => {
  const calls = [];
  const timestamp = new Date('2026-05-20T12:00:00.000Z');
  const useCase = new SwitchUserRoleUseCase({
    now: () => timestamp,
    userRoleGateway: {
      async findUserById(userId) {
        calls.push(['find', userId]);
        return {
          _id: 'user-db-id',
          username: 'ada',
          role: 'promoter',
        };
      },
      async updateUserRole(command) {
        calls.push(['update', command]);
      },
    },
  });

  const result = await useCase.execute(SwitchUserRoleDto.fromRequest({
    userId: 'user-1',
    body: { role: 'marketer' },
  }));

  assert.deepEqual(calls, [
    ['find', 'user-1'],
    ['update', {
      userId: 'user-db-id',
      role: 'marketer',
      activity: {
        action: 'role_change',
        description: 'You switched user role to marketer',
        timestamp,
      },
    }],
  ]);
  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      message: "User role successfully switched to 'marketer'.",
    },
    meta: {
      username: 'ada',
      role: 'marketer',
    },
  });
});

test('SwitchUserRoleUseCase lets gateway errors propagate to controller failure paths', async () => {
  const useCase = new SwitchUserRoleUseCase({
    userRoleGateway: {
      async findUserById() {
        throw new Error('role lookup failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new SwitchUserRoleDto({
      userId: 'user-1',
      role: 'marketer',
    })),
    /role lookup failed/,
  );
});
