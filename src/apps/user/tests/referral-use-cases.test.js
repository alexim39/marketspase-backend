import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GetReferralDetailsDto,
  GetReferralStatsDto,
  ValidateReferralCodeDto,
} from '../application/dto/referral-query.dto.js';
import { GetReferralDetailsUseCase } from '../application/use-cases/get-referral-details.use-case.js';
import { GetReferralStatsUseCase } from '../application/use-cases/get-referral-stats.use-case.js';
import { ValidateReferralCodeUseCase } from '../application/use-cases/validate-referral-code.use-case.js';

test('GetReferralStatsUseCase preserves missing userId guard', async () => {
  const useCase = new GetReferralStatsUseCase({
    referralGateway: {
      async findUserById() {
        throw new Error('should not query user');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new GetReferralStatsDto()), {
    statusCode: 400,
    body: {
      success: false,
      message: 'userId is required.',
    },
  });
});

test('GetReferralStatsUseCase preserves missing user response', async () => {
  const useCase = new GetReferralStatsUseCase({
    referralGateway: {
      async findUserById(userId) {
        assert.equal(userId, 'user-1');
        return null;
      },
    },
  });

  assert.deepEqual(await useCase.execute(new GetReferralStatsDto({
    userId: 'user-1',
  })), {
    statusCode: 404,
    body: {
      success: false,
      message: 'User not found.',
    },
  });
});

test('GetReferralStatsUseCase preserves self/admin authorization and response shape', async () => {
  const calls = [];
  const stats = {
    totalReferrals: 3,
    totalEarned: 750,
    referralLink: 'https://marketspase.com/ref/ada',
  };
  const useCase = new GetReferralStatsUseCase({
    referralGateway: {
      async findUserById(userId) {
        calls.push(['find', userId]);
        return { _id: userId };
      },
      async getUserReferralStats(userId) {
        calls.push(['stats', userId]);
        return stats;
      },
    },
  });

  const result = await useCase.execute(GetReferralStatsDto.fromRequest({
    params: { userId: 'user-1' },
    user: { _id: 'user-1', role: 'promoter' },
  }));

  assert.deepEqual(calls, [
    ['find', 'user-1'],
    ['stats', 'user-1'],
  ]);
  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      data: stats,
    },
  });
});

test('GetReferralStatsUseCase preserves forbidden response for other users', async () => {
  const useCase = new GetReferralStatsUseCase({
    referralGateway: {
      async findUserById() {
        return { _id: 'user-2' };
      },
      async getUserReferralStats() {
        throw new Error('should not load stats');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new GetReferralStatsDto({
    userId: 'user-2',
    requestUserId: 'user-1',
    requestUserRole: 'promoter',
  })), {
    statusCode: 403,
    body: {
      success: false,
      message: 'You are not allowed to view referral statistics for this user',
    },
  });
});

test('GetReferralDetailsUseCase preserves pagination, sorting, referee mapping, and response shape', async () => {
  const calls = [];
  const referrals = [
    {
      refereeUserId: 'referee-old',
      refereeRole: 'promoter',
      status: 'pending',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      refereeUserId: 'referee-new-known',
      refereeRole: 'marketer',
      status: 'paid',
      createdAt: '2026-05-01T00:00:00.000Z',
    },
    {
      refereeUserId: 'referee-new-unknown',
      refereeRole: 'promoter',
      status: 'pending',
      createdAt: '2026-04-01T00:00:00.000Z',
    },
  ];
  const useCase = new GetReferralDetailsUseCase({
    referralGateway: {
      async findReferralUser(userId) {
        calls.push(['find', userId]);
        return {
          _id: userId,
          username: 'ada',
          referralInfo: { referrals },
        };
      },
      async findUsersByIds(userIds) {
        calls.push(['users', userIds]);
        return [
          {
            _id: 'referee-new-known',
            username: 'known',
            displayName: 'Known User',
          },
        ];
      },
    },
  });

  const result = await useCase.execute(GetReferralDetailsDto.fromRequest({
    params: { userId: 'user-1' },
    query: { page: '1', limit: '2' },
    user: { _id: 'admin-1', role: 'admin' },
  }));

  assert.deepEqual(calls, [
    ['find', 'user-1'],
    ['users', ['referee-new-known', 'referee-new-unknown']],
  ]);
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.total, 3);
  assert.equal(result.body.data.page, 1);
  assert.equal(result.body.data.totalPages, 2);
  assert.deepEqual(result.body.data.referrals, [
    {
      ...referrals[1],
      referee: {
        _id: 'referee-new-known',
        username: 'known',
        displayName: 'Known User',
      },
    },
    {
      ...referrals[2],
      referee: { username: 'Unknown User' },
    },
  ]);
});

test('GetReferralDetailsUseCase preserves forbidden details response for other users', async () => {
  const useCase = new GetReferralDetailsUseCase({
    referralGateway: {
      async findReferralUser() {
        return { referralInfo: { referrals: [] } };
      },
      async findUsersByIds() {
        throw new Error('should not load referees');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new GetReferralDetailsDto({
    userId: 'user-2',
    requestUserId: 'user-1',
  })), {
    statusCode: 403,
    body: {
      success: false,
      message: 'You are not allowed to view referral details for this user',
    },
  });
});

test('ValidateReferralCodeUseCase preserves invalid and valid referral code responses', async () => {
  const useCase = new ValidateReferralCodeUseCase({
    referralGateway: {
      async findReferralCodeOwner(referralCode) {
        if (referralCode === 'ada') {
          return {
            username: 'ada',
            displayName: 'Ada Lovelace',
          };
        }

        return null;
      },
    },
  });

  assert.deepEqual(await useCase.execute(new ValidateReferralCodeDto({
    referralCode: 'missing',
  })), {
    statusCode: 404,
    body: {
      success: false,
      message: 'Invalid referral code',
    },
  });

  assert.deepEqual(await useCase.execute(ValidateReferralCodeDto.fromRequest({
    params: { referralCode: 'ada' },
  })), {
    statusCode: 200,
    body: {
      success: true,
      data: {
        valid: true,
        referrerName: 'Ada Lovelace',
        referrerUsername: 'ada',
      },
    },
  });
});

test('Referral use cases let gateway errors propagate to controller failure paths', async () => {
  const useCase = new ValidateReferralCodeUseCase({
    referralGateway: {
      async findReferralCodeOwner() {
        throw new Error('referral lookup failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new ValidateReferralCodeDto({ referralCode: 'ada' })),
    /referral lookup failed/,
  );
});
