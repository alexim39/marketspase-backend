import test from "node:test";
import assert from "node:assert/strict";

import { GetAvailableContactAdminsUseCase } from "../application/use-cases/get-available-contact-admins.use-case.js";

test("GetAvailableContactAdminsUseCase returns the legacy admins response shape", async () => {
  const admins = [
    {
      _id: "admin-1",
      username: "adminuser",
      displayName: "Admin User",
      avatar: "/admin.png",
    },
  ];

  const useCase = new GetAvailableContactAdminsUseCase({
    contactUserRepository: {
      async findAvailableContactAdmins() {
        return admins;
      },
    },
  });

  const result = await useCase.execute();

  assert.deepEqual(result, {
    success: true,
    data: admins,
  });
});
