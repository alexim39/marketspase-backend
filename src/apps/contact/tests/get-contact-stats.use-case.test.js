import test from "node:test";
import assert from "node:assert/strict";

import { GetContactStatsUseCase } from "../application/use-cases/get-contact-stats.use-case.js";

test("GetContactStatsUseCase returns the legacy stats response shape", async () => {
  const stats = {
    total: 12,
    byStatus: [{ _id: "open", count: 4 }],
  };

  const useCase = new GetContactStatsUseCase({
    contactRepository: {
      async getStats() {
        return stats;
      },
    },
  });

  const result = await useCase.execute();

  assert.deepEqual(result, {
    success: true,
    data: stats,
  });
});
