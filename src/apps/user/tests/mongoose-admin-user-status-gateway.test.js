import test from 'node:test';
import assert from 'node:assert/strict';

import { MongooseAdminUserStatusGateway } from '../infrastructure/gateways/mongoose-admin-user-status.gateway.js';

test('MongooseAdminUserStatusGateway updates active status atomically without saving full user documents', async () => {
  const calls = [];
  const updatedAt = new Date('2026-06-07T08:00:00.000Z');
  const gateway = new MongooseAdminUserStatusGateway({
    userModel: {
      async findByIdAndUpdate(id, update, options) {
        calls.push(['findByIdAndUpdate', id, update, options]);
        return {
          _id: id,
          isActive: update.$set.isActive,
          updatedAt,
        };
      },
    },
  });

  const updatedUser = await gateway.saveUserActiveStatus({
    user: {
      _id: 'user-1',
      save() {
        throw new Error('save should not be called for status updates');
      },
    },
    isActive: true,
  });

  assert.deepEqual(calls, [
    ['findByIdAndUpdate', 'user-1', { $set: { isActive: true } }, { new: true }],
  ]);
  assert.deepEqual(updatedUser, {
    _id: 'user-1',
    isActive: true,
    updatedAt,
  });
});

test('MongooseAdminUserStatusGateway appends status audit entries atomically', async () => {
  const calls = [];
  const gateway = new MongooseAdminUserStatusGateway({
    userModel: {
      async updateOne(filter, update) {
        calls.push(['updateOne', filter, update]);
        return { modifiedCount: 1 };
      },
    },
  });

  await gateway.logUserStatusChange({
    user: { _id: 'user-1' },
    isActive: true,
    actorId: 'admin-1',
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][1], { _id: 'user-1' });
  assert.equal(calls[0][2].$push.activityLog.$each[0].action, 'account_suspend');
  assert.equal(calls[0][2].$push.activityLog.$each[0].description, 'User status changed to active');
  assert.equal(calls[0][2].$push.activityLog.$each[0].metadata.performedBy, 'admin-1');
  assert.equal(calls[0][2].$push.activityLog.$position, 0);
  assert.equal(calls[0][2].$push.activityLog.$slice, 1000);
});
