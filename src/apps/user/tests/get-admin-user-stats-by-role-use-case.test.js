import test from 'node:test';
import assert from 'node:assert/strict';

import { GetAdminUserStatsByRoleDto } from '../application/dto/get-admin-user-stats-by-role.dto.js';
import { GetAdminUserStatsByRoleUseCase } from '../application/use-cases/get-admin-user-stats-by-role.use-case.js';

test('GetAdminUserStatsByRoleUseCase preserves invalid role response', async () => {
  const useCase = new GetAdminUserStatsByRoleUseCase({
    adminUserStatsByRoleGateway: {
      async getUserStatsByRole() {
        throw new Error('should not query stats');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new GetAdminUserStatsByRoleDto({
    role: 'buyer',
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Invalid role. Must be one of: marketer, promoter, admin',
    },
  });
});

test('GetAdminUserStatsByRoleUseCase returns the legacy successful stats response', async () => {
  const calls = [];
  const useCase = new GetAdminUserStatsByRoleUseCase({
    now: () => new Date('2026-06-04T12:00:00.000Z'),
    adminUserStatsByRoleGateway: {
      async getUserStatsByRole(query) {
        calls.push(query);
        return {
          totalUsers: 10,
          activeUsers: 7,
          verifiedUsers: 6,
          deletedUsers: 2,
          recentUsers: 3,
          balanceData: { total: 4000, average: 400 },
          ratingData: { avgRating: 4.5, totalRatings: 20 },
          referralData: { totalReferrals: 8, totalEarned: 900 },
        };
      },
    },
  });

  assert.deepEqual(await useCase.execute(GetAdminUserStatsByRoleDto.fromRequest({
    params: { role: 'promoter' },
  })), {
    statusCode: 200,
    body: {
      success: true,
      data: {
        role: 'promoter',
        counts: {
          total: 10,
          active: 7,
          inactive: 3,
          verified: 6,
          unverified: 4,
          deleted: 2,
          recent: 3,
        },
        financial: {
          totalBalance: 4000,
          averageBalance: 400,
          currency: 'NGN',
        },
        engagement: {
          averageRating: 4.5,
          totalRatings: 20,
          percentageRated: 200,
        },
        activity: {
          totalReferrals: { totalReferrals: 8, totalEarned: 900 },
        },
      },
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].role, 'promoter');
  assert.equal(calls[0].recentSince.toISOString(), '2026-05-05T12:00:00.000Z');
});

test('GetAdminUserStatsByRoleUseCase preserves legacy default aggregate values', async () => {
  const useCase = new GetAdminUserStatsByRoleUseCase({
    adminUserStatsByRoleGateway: {
      async getUserStatsByRole() {
        return {
          totalUsers: 0,
          activeUsers: 0,
          verifiedUsers: 0,
          deletedUsers: 0,
          recentUsers: 0,
        };
      },
    },
  });

  assert.deepEqual(await useCase.execute(new GetAdminUserStatsByRoleDto({
    role: 'admin',
  })), {
    statusCode: 200,
    body: {
      success: true,
      data: {
        role: 'admin',
        counts: {
          total: 0,
          active: 0,
          inactive: 0,
          verified: 0,
          unverified: 0,
          deleted: 0,
          recent: 0,
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
          totalReferrals: { totalReferrals: 0, totalEarned: 0 },
        },
      },
    },
  });
});

test('GetAdminUserStatsByRoleUseCase lets gateway errors propagate to controller failure paths', async () => {
  const useCase = new GetAdminUserStatsByRoleUseCase({
    adminUserStatsByRoleGateway: {
      async getUserStatsByRole() {
        throw new Error('user stats by role failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new GetAdminUserStatsByRoleDto({
      role: 'marketer',
    })),
    /user stats by role failed/,
  );
});
