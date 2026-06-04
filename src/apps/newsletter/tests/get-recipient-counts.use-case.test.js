import test from "node:test";
import assert from "node:assert/strict";

import { GetRecipientCountsUseCase } from "../application/use-cases/get-recipient-counts.use-case.js";

test("GetRecipientCountsUseCase returns recipient counts in the legacy response shape", async () => {
  const calls = [];
  const useCase = new GetRecipientCountsUseCase({
    recipientRepository: {
      async countActiveUsers() {
        calls.push("all");
        return 100;
      },
      async countActiveUsersByRole(role) {
        calls.push(role);
        return role === "marketer" ? 40 : 60;
      },
    },
  });

  const result = await useCase.execute();

  assert.deepEqual(result, {
    success: true,
    data: {
      all: 100,
      marketers: 40,
      promoters: 60,
    },
    message: "Recipient counts retrieved successfully",
  });
  assert.deepEqual(calls, ["all", "marketer", "promoter"]);
});

test("GetRecipientCountsUseCase lets repository errors propagate to the controller failure path", async () => {
  const useCase = new GetRecipientCountsUseCase({
    recipientRepository: {
      async countActiveUsers() {
        throw new Error("Count failed");
      },
      async countActiveUsersByRole() {
        return 0;
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(),
    /Count failed/,
  );
});
