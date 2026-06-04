import test from 'node:test';
import assert from 'node:assert/strict';

import { GetAdminRoleStatisticsDto } from '../application/dto/get-admin-role-statistics.dto.js';
import { GetAdminRoleStatisticsUseCase } from '../application/use-cases/get-admin-role-statistics.use-case.js';

test('GetAdminRoleStatisticsUseCase preserves invalid role response', async () => {
  const useCase = new GetAdminRoleStatisticsUseCase({
    adminRoleStatisticsGateway: {
      async getRoleStatistics() {
        throw new Error('should not query stats');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new GetAdminRoleStatisticsDto({
    role: 'buyer',
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Invalid role. Must be one of: marketer, promoter, admin',
    },
  });
});

test('GetAdminRoleStatisticsUseCase returns legacy stats and derived counts', async () => {
  const gatewayStats = {
    role: 'marketer',
    counts: {
      total: 10,
      active: 7,
      verified: 4,
      recent: 2,
    },
    financial: {
      totalBalance: 12000,
      averageBalance: 1200,
      currency: 'NGN',
    },
    engagement: {
      averageRating: 4.2,
      totalRatings: 30,
      percentageRated: 60,
    },
    activity: {
      totalReferrals: 8,
      totalEarned: 5000,
    },
  };
  const calls = [];
  const useCase = new GetAdminRoleStatisticsUseCase({
    now: () => new Date('2026-06-04T12:00:00.000Z'),
    adminRoleStatisticsGateway: {
      async getRoleStatistics(query) {
        calls.push(query);
        return gatewayStats;
      },
    },
  });

  assert.deepEqual(await useCase.execute(GetAdminRoleStatisticsDto.fromRequest({
    params: { role: 'marketer' },
  })), {
    statusCode: 200,
    body: {
      success: true,
      message: 'marketer statistics fetched successfully',
      data: {
        role: 'marketer',
        counts: {
          total: 10,
          active: 7,
          verified: 4,
          recent: 2,
          inactive: 3,
          unverified: 6,
          deleted: 0,
        },
        financial: {
          totalBalance: 12000,
          averageBalance: 1200,
          currency: 'NGN',
        },
        engagement: {
          averageRating: 4.2,
          totalRatings: 30,
          percentageRated: 60,
        },
        activity: {
          totalReferrals: 8,
          totalEarned: 5000,
        },
      },
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].role, 'marketer');
  assert.equal(calls[0].thirtyDaysAgo.toISOString(), '2026-05-05T12:00:00.000Z');
});

test('GetAdminRoleStatisticsUseCase preserves legacy default empty stats', async () => {
  const useCase = new GetAdminRoleStatisticsUseCase({
    now: () => new Date('2026-06-04T12:00:00.000Z'),
    adminRoleStatisticsGateway: {
      async getRoleStatistics() {
        return null;
      },
    },
  });

  assert.deepEqual(await useCase.execute(new GetAdminRoleStatisticsDto({
    role: 'admin',
  })), {
    statusCode: 200,
    body: {
      success: true,
      message: 'admin statistics fetched successfully',
      data: {
        role: 'admin',
        counts: {
          total: 0,
          active: 0,
          verified: 0,
          recent: 0,
          inactive: 0,
          unverified: 0,
          deleted: 0,
        },
        financial: {
          totalBalance: 0,
          averageBalance: 0,
          currency: 'NGN',
        },
        engagement: {
          averageRating: 0,
          totalRatings: 0,
          percentageRated: 0,
        },
        activity: {
          totalReferrals: 0,
          totalEarned: 0,
        },
      },
    },
  });
});

test('GetAdminRoleStatisticsUseCase lets gateway errors propagate to controller failure paths', async () => {
  const useCase = new GetAdminRoleStatisticsUseCase({
    adminRoleStatisticsGateway: {
      async getRoleStatistics() {
        throw new Error('role statistics aggregation failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new GetAdminRoleStatisticsDto({
      role: 'promoter',
    })),
    /role statistics aggregation failed/,
  );
});
