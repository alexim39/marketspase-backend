import test from 'node:test';
import assert from 'node:assert/strict';

import { GetAdminUserSummaryDto } from '../application/dto/get-admin-user-summary.dto.js';
import { GetAdminUserSummaryUseCase } from '../application/use-cases/get-admin-user-summary.use-case.js';

test('GetAdminUserSummaryUseCase returns the legacy successful summary response', async () => {
  const summary = {
    roleCounts: { marketer: 3, promoter: 7 },
    totals: { total: 10, active: 8, verified: 6 },
    recent: { recentRegistrations: 2, recentActive: 2 },
    monthlyGrowth: [{ _id: { year: 2026, month: 6 }, count: 10 }],
  };
  const calls = [];
  const useCase = new GetAdminUserSummaryUseCase({
    now: () => new Date('2026-06-04T12:00:00.000Z'),
    adminUserSummaryGateway: {
      async getUserSummary(query) {
        calls.push(query);
        return summary;
      },
    },
  });

  assert.deepEqual(await useCase.execute(GetAdminUserSummaryDto.fromRequest()), {
    statusCode: 200,
    body: {
      success: true,
      message: 'User summary fetched successfully',
      data: summary,
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].thirtyDaysAgo.toISOString(), '2026-05-05T12:00:00.000Z');
});

test('GetAdminUserSummaryUseCase preserves the legacy default empty summary', async () => {
  const useCase = new GetAdminUserSummaryUseCase({
    now: () => new Date('2026-06-04T12:00:00.000Z'),
    adminUserSummaryGateway: {
      async getUserSummary() {
        return null;
      },
    },
  });

  assert.deepEqual(await useCase.execute(), {
    statusCode: 200,
    body: {
      success: true,
      message: 'User summary fetched successfully',
      data: {
        roleCounts: {},
        totals: { total: 0, active: 0, verified: 0 },
        recent: { recentRegistrations: 0, recentActive: 0 },
        monthlyGrowth: [],
      },
    },
  });
});

test('GetAdminUserSummaryUseCase lets gateway errors propagate to controller failure paths', async () => {
  const useCase = new GetAdminUserSummaryUseCase({
    adminUserSummaryGateway: {
      async getUserSummary() {
        throw new Error('summary aggregation failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(),
    /summary aggregation failed/,
  );
});
