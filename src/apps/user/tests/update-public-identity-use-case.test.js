import test from 'node:test';
import assert from 'node:assert/strict';

import { UpdatePublicIdentityDto } from '../application/dto/update-public-identity.dto.js';
import { UpdatePublicIdentityUseCase } from '../application/use-cases/update-public-identity.use-case.js';

test('UpdatePublicIdentityUseCase preserves missing authentication response', async () => {
  const useCase = new UpdatePublicIdentityUseCase({
    publicIdentityGateway: {},
  });

  assert.deepEqual(await useCase.execute(new UpdatePublicIdentityDto({
    body: { username: 'ada' },
  })), {
    statusCode: 401,
    body: {
      success: false,
      message: 'Authentication required.',
    },
  });
});

test('UpdatePublicIdentityUseCase preserves username validation responses', async () => {
  const useCase = new UpdatePublicIdentityUseCase({
    publicIdentityGateway: {},
  });

  assert.deepEqual(await useCase.execute(new UpdatePublicIdentityDto({
    userId: 'user-1',
    body: { username: '   ' },
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Username is required.',
    },
  });

  assert.deepEqual(await useCase.execute(new UpdatePublicIdentityDto({
    userId: 'user-1',
    body: { username: 'bad-name!' },
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Username can only contain letters, numbers, and underscores.',
    },
  });
});

test('UpdatePublicIdentityUseCase preserves no fields response', async () => {
  const useCase = new UpdatePublicIdentityUseCase({
    publicIdentityGateway: {},
  });

  assert.deepEqual(await useCase.execute(new UpdatePublicIdentityDto({
    userId: 'user-1',
    body: {},
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'No public identity fields were provided.',
    },
  });
});

test('UpdatePublicIdentityUseCase preserves duplicate username response before update', async () => {
  const calls = [];
  const useCase = new UpdatePublicIdentityUseCase({
    publicIdentityGateway: {
      async findExistingUsername(query) {
        calls.push(['find', query]);
        return { _id: 'user-2' };
      },
      async updatePublicIdentity() {
        throw new Error('should not update duplicate username');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdatePublicIdentityDto({
    userId: 'user-1',
    body: { username: ' Ada_New ' },
  })), {
    statusCode: 409,
    body: {
      success: false,
      message: 'Username is already in use by another user.',
    },
  });
  assert.deepEqual(calls, [
    ['find', {
      username: 'Ada_New',
      excludedUserId: 'user-1',
    }],
  ]);
});

test('UpdatePublicIdentityUseCase updates username, referral code, and social links', async () => {
  const calls = [];
  const updatedUser = {
    _id: 'user-1',
    async logActivity() {
      throw new Error('gateway owns activity logging');
    },
  };
  const useCase = new UpdatePublicIdentityUseCase({
    publicIdentityGateway: {
      async findExistingUsername(query) {
        calls.push(['find', query]);
        return null;
      },
      async updatePublicIdentity(command) {
        calls.push(['update', command]);
        return updatedUser;
      },
      async logPublicIdentityUpdate(command) {
        calls.push(['log', command]);
      },
    },
  });

  const result = await useCase.execute(UpdatePublicIdentityDto.fromRequest({
    userId: 'user-1',
    body: {
      username: ' ada_marketspase ',
      instagram: ' @ada ',
      website: null,
      linkedin: undefined,
    },
  }));

  assert.deepEqual(calls, [
    ['find', {
      username: 'ada_marketspase',
      excludedUserId: 'user-1',
    }],
    ['update', {
      userId: 'user-1',
      updateFields: {
        username: 'ada_marketspase',
        'referralInfo.referralCode': 'ada_marketspase',
        'professionalInfo.socialProfiles.website': '',
        'professionalInfo.socialProfiles.instagram': '@ada',
      },
    }],
    ['log', {
      user: updatedUser,
      updatedFields: [
        'username',
        'referralInfo.referralCode',
        'professionalInfo.socialProfiles.website',
        'professionalInfo.socialProfiles.instagram',
      ],
    }],
  ]);
  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      message: 'Public identity updated successfully.',
    },
  });
});

test('UpdatePublicIdentityUseCase preserves missing updated user response', async () => {
  const useCase = new UpdatePublicIdentityUseCase({
    publicIdentityGateway: {
      async updatePublicIdentity() {
        return null;
      },
      async logPublicIdentityUpdate() {
        throw new Error('should not log missing user');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdatePublicIdentityDto({
    userId: 'user-1',
    body: { instagram: '@ada' },
  })), {
    statusCode: 404,
    body: {
      success: false,
      message: 'User not found.',
    },
  });
});

test('UpdatePublicIdentityUseCase lets gateway errors propagate to controller failure paths', async () => {
  const useCase = new UpdatePublicIdentityUseCase({
    publicIdentityGateway: {
      async updatePublicIdentity() {
        throw new Error('identity update failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new UpdatePublicIdentityDto({
      userId: 'user-1',
      body: { instagram: '@ada' },
    })),
    /identity update failed/,
  );
});
