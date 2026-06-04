import test from 'node:test';
import assert from 'node:assert/strict';

import { GetAdminUsersDto } from '../application/dto/get-admin-users.dto.js';
import { GetAdminUsersUseCase } from '../application/use-cases/get-admin-users.use-case.js';

const projection = {
  password: 0,
  notificationSettings: 0,
  deviceTokens: 0,
  sseConnections: 0,
  activityLog: 0,
  'wallets.marketer.transactions': 0,
  'wallets.promoter.transactions': 0,
};

test('GetAdminUsersUseCase returns the legacy successful listing response', async () => {
  const users = [
    { _id: 'user-1', username: 'ada' },
    { _id: 'user-2', username: 'grace' },
  ];
  const calls = [];

  const useCase = new GetAdminUsersUseCase({
    adminUserListGateway: {
      async findUsers(query) {
        calls.push(query);
        return { users, total: 75 };
      },
    },
  });

  assert.deepEqual(await useCase.execute(GetAdminUsersDto.fromRequest({ query: {} })), {
    statusCode: 200,
    body: {
      success: true,
      message: 'Users fetched successfully',
      data: {
        users,
        pagination: {
          total: 75,
          page: 1,
          limit: 50,
          totalPages: 2,
          hasNext: true,
          hasPrev: false,
        },
      },
    },
  });

  assert.deepEqual(calls, [{
    query: { isDeleted: false },
    sort: { createdAt: -1 },
    projection,
    skip: 0,
    limit: 50,
  }]);
});

test('GetAdminUsersUseCase builds legacy filters, sort, skip, and capped limit', async () => {
  let receivedQuery;
  const useCase = new GetAdminUsersUseCase({
    adminUserListGateway: {
      async findUsers(query) {
        receivedQuery = query;
        return { users: [], total: 401 };
      },
    },
  });

  const result = await useCase.execute(GetAdminUsersDto.fromRequest({
    query: {
      page: '3',
      limit: '500',
      role: 'promoter',
      isActive: 'true',
      isVerified: 'false',
      search: ' Ada ',
      sort: 'username',
    },
  }));

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
    'personalInfo.phone',
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

test('GetAdminUsersUseCase preserves legacy non-boolean status filter pass-through', async () => {
  let receivedQuery;
  const useCase = new GetAdminUsersUseCase({
    adminUserListGateway: {
      async findUsers(query) {
        receivedQuery = query;
        return { users: [], total: 0 };
      },
    },
  });

  await useCase.execute(new GetAdminUsersDto({
    isActive: 'pending',
    isVerified: true,
  }));

  assert.equal(receivedQuery.query.isActive, 'pending');
  assert.equal(receivedQuery.query.isVerified, true);
});

test('GetAdminUsersUseCase lets gateway errors propagate to controller failure paths', async () => {
  const useCase = new GetAdminUsersUseCase({
    adminUserListGateway: {
      async findUsers() {
        throw new Error('admin users query failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new GetAdminUsersDto()),
    /admin users query failed/,
  );
});
