import test from 'node:test';
import assert from 'node:assert/strict';

import { StreamAdminUsersDto } from '../application/dto/stream-admin-users.dto.js';
import { StreamAdminUsersUseCase } from '../application/use-cases/stream-admin-users.use-case.js';

const projection = {
  password: 0,
  notificationSettings: 0,
  deviceTokens: 0,
  sseConnections: 0,
  activityLog: 0,
  'wallets.marketer.transactions': 0,
  'wallets.promoter.transactions': 0,
};

test('StreamAdminUsersUseCase returns legacy stream metadata and cursor query', () => {
  const cursor = { on() {} };
  let receivedQuery;
  const useCase = new StreamAdminUsersUseCase({
    now: () => new Date('2026-05-20T15:00:00.000Z'),
    adminUserListGateway: {
      streamUsersForExport(query) {
        receivedQuery = query;
        return cursor;
      },
    },
  });

  const result = useCase.execute(StreamAdminUsersDto.fromRequest({
    query: {
      search: ' Ada ',
      role: 'promoter',
      isActive: 'true',
      isVerified: 'false',
    },
  }));

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.headers, {
    'Content-Type': 'application/json',
    'Content-Disposition': 'attachment; filename="users_export_2026-05-20.json"',
  });
  assert.equal(result.cursor, cursor);
  assert.equal(result.openingChunk, '{"success":true,"message":"Users export stream","data":{"users":[');
  assert.equal(result.closingChunk, ']}}');

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
  assert.deepEqual(receivedQuery.projection, projection);
  assert.deepEqual(receivedQuery.sort, { createdAt: -1 });
  assert.equal(receivedQuery.batchSize, 100);
});

test('StreamAdminUsersUseCase formats marketer and promoter balances like the legacy stream', () => {
  const useCase = new StreamAdminUsersUseCase({
    adminUserListGateway: {
      streamUsersForExport() {
        return { on() {} };
      },
    },
  });
  const result = useCase.execute(new StreamAdminUsersDto());
  const createdAt = new Date('2026-05-20T15:00:00.000Z');
  const updatedAt = new Date('2026-05-21T15:00:00.000Z');

  assert.deepEqual(result.formatRecord({
    _id: 'user-1',
    uid: 'uid-1',
    username: 'marketer',
    displayName: 'Market User',
    email: 'market@example.com',
    role: 'marketer',
    isActive: true,
    isVerified: false,
    isDeleted: false,
    wallets: {
      marketer: { balance: 1200 },
      promoter: { balance: 500 },
    },
    createdAt,
    updatedAt,
  }), {
    _id: 'user-1',
    uid: 'uid-1',
    username: 'marketer',
    displayName: 'Market User',
    email: 'market@example.com',
    role: 'marketer',
    isActive: true,
    isVerified: false,
    isDeleted: false,
    balance: 1200,
    createdAt,
    updatedAt,
  });

  assert.equal(result.formatRecord({
    role: 'promoter',
    wallets: {
      marketer: { balance: 1200 },
      promoter: { balance: 500 },
    },
  }).balance, 500);
  assert.equal(result.formatRecord({
    role: 'admin',
    wallets: {},
  }).balance, 0);
});

test('StreamAdminUsersUseCase lets gateway errors propagate to controller failure paths', () => {
  const useCase = new StreamAdminUsersUseCase({
    adminUserListGateway: {
      streamUsersForExport() {
        throw new Error('stream cursor failed');
      },
    },
  });

  assert.throws(
    () => useCase.execute(new StreamAdminUsersDto()),
    /stream cursor failed/,
  );
});
