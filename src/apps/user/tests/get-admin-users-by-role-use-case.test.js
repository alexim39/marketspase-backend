import test from 'node:test';
import assert from 'node:assert/strict';

import { GetAdminUsersByRoleDto } from '../application/dto/get-admin-users-by-role.dto.js';
import { GetAdminUsersByRoleUseCase } from '../application/use-cases/get-admin-users-by-role.use-case.js';

const projection = {
  password: 0,
  notificationSettings: 0,
  deviceTokens: 0,
  sseConnections: 0,
  activityLog: 0,
  'wallets.marketer.transactions': 0,
  'wallets.promoter.transactions': 0,
};

test('GetAdminUsersByRoleUseCase preserves invalid role response before repository access', async () => {
  const useCase = new GetAdminUsersByRoleUseCase({
    adminUserListGateway: {
      async findUsers() {
        throw new Error('should not query invalid role');
      },
    },
  });

  assert.deepEqual(await useCase.execute(GetAdminUsersByRoleDto.fromRequest({
    params: { role: 'moderator' },
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Invalid role. Must be one of: marketer, promoter, admin',
    },
  });
});

test('GetAdminUsersByRoleUseCase returns the legacy successful role listing response', async () => {
  const users = [
    { _id: 'user-1', username: 'ada', role: 'marketer' },
  ];
  const calls = [];

  const useCase = new GetAdminUsersByRoleUseCase({
    adminUserListGateway: {
      async findUsers(query) {
        calls.push(query);
        return { users, total: 50 };
      },
    },
  });

  assert.deepEqual(await useCase.execute(GetAdminUsersByRoleDto.fromRequest({
    params: { role: 'marketer' },
    query: {},
  })), {
    statusCode: 200,
    body: {
      success: true,
      message: 'Marketer users fetched successfully',
      data: {
        users,
        pagination: {
          total: 50,
          page: 1,
          limit: 50,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      },
    },
  });

  assert.deepEqual(calls, [{
    query: {
      isDeleted: false,
      role: 'marketer',
    },
    sort: { createdAt: -1 },
    projection,
    skip: 0,
    limit: 50,
  }]);
});

test('GetAdminUsersByRoleUseCase builds legacy filters, role search fields, sort, skip, and capped limit', async () => {
  let receivedQuery;
  const useCase = new GetAdminUsersByRoleUseCase({
    adminUserListGateway: {
      async findUsers(query) {
        receivedQuery = query;
        return { users: [], total: 401 };
      },
    },
  });

  const result = await useCase.execute(GetAdminUsersByRoleDto.fromRequest({
    params: { role: 'promoter' },
    query: {
      page: '3',
      limit: '500',
      isActive: 'true',
      isVerified: 'false',
      search: ' Ada ',
      sort: 'username',
    },
  }));

  assert.equal(result.body.message, 'Promoter users fetched successfully');
  assert.equal(result.body.data.pagination.total, 401);
  assert.equal(result.body.data.pagination.page, 3);
  assert.equal(result.body.data.pagination.limit, 200);
  assert.equal(result.body.data.pagination.totalPages, 3);
  assert.equal(result.body.data.pagination.hasNext, false);
  assert.equal(result.body.data.pagination.hasPrev, true);

  assert.equal(receivedQuery.query.isDeleted, false);
  assert.equal(receivedQuery.query.role, 'promoter');
  assert.equal(receivedQuery.query.isActive, true);
  assert.equal(receivedQuery.query.isVerified, false);
  assert.deepEqual(receivedQuery.query.$or.map((entry) => Object.keys(entry)[0]), [
    'username',
    'email',
    'displayName',
  ]);
  for (const entry of receivedQuery.query.$or) {
    const regex = Object.values(entry)[0];
    assert.equal(regex.source, 'Ada');
    assert.equal(regex.flags, 'i');
  }
  assert.deepEqual(receivedQuery.sort, { username: 1 });
  assert.deepEqual(receivedQuery.projection, projection);
  assert.equal(receivedQuery.skip, 400);
  assert.equal(receivedQuery.limit, 200);
});

test('GetAdminUsersByRoleUseCase preserves legacy false coercion for non-true status filters', async () => {
  let receivedQuery;
  const useCase = new GetAdminUsersByRoleUseCase({
    adminUserListGateway: {
      async findUsers(query) {
        receivedQuery = query;
        return { users: [], total: 0 };
      },
    },
  });

  await useCase.execute(new GetAdminUsersByRoleDto({
    role: 'admin',
    isActive: 'pending',
    isVerified: true,
  }));

  assert.equal(receivedQuery.query.role, 'admin');
  assert.equal(receivedQuery.query.isActive, false);
  assert.equal(receivedQuery.query.isVerified, false);
});

test('GetAdminUsersByRoleUseCase lets gateway errors propagate to controller failure paths', async () => {
  const useCase = new GetAdminUsersByRoleUseCase({
    adminUserListGateway: {
      async findUsers() {
        throw new Error('admin users by role query failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new GetAdminUsersByRoleDto({
      role: 'marketer',
    })),
    /admin users by role query failed/,
  );
});
