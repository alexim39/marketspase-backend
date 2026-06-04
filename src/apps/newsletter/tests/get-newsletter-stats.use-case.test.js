import test from "node:test";
import assert from "node:assert/strict";

import { GetNewsletterStatsUseCase } from "../application/use-cases/get-newsletter-stats.use-case.js";

test("GetNewsletterStatsUseCase returns aggregate stats in the legacy response shape", async () => {
  const aggregateStats = {
    _id: null,
    total: 8,
    draft: 2,
    scheduled: 1,
    sent: 5,
    totalSent: 400,
    avgOpenRate: 24.5,
    avgClickRate: 3.25,
  };

  const useCase = new GetNewsletterStatsUseCase({
    newsletterRepository: {
      async getStats() {
        return [aggregateStats];
      },
    },
  });

  const result = await useCase.execute();

  assert.deepEqual(result, {
    success: true,
    data: aggregateStats,
    message: "Newsletter statistics retrieved successfully",
  });
});

test("GetNewsletterStatsUseCase returns the legacy empty stats fallback", async () => {
  const useCase = new GetNewsletterStatsUseCase({
    newsletterRepository: {
      async getStats() {
        return [];
      },
    },
  });

  const result = await useCase.execute();

  assert.deepEqual(result, {
    success: true,
    data: {
      total: 0,
      draft: 0,
      scheduled: 0,
      sent: 0,
      totalSent: 0,
      avgOpenRate: 0,
      avgClickRate: 0,
    },
    message: "Newsletter statistics retrieved successfully",
  });
});

test("GetNewsletterStatsUseCase lets repository errors propagate to the controller failure path", async () => {
  const useCase = new GetNewsletterStatsUseCase({
    newsletterRepository: {
      async getStats() {
        throw new Error("Aggregate failed");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(),
    /Aggregate failed/,
  );
});
