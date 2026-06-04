import test from "node:test";
import assert from "node:assert/strict";

import { ToggleNotificationUseCase } from "../application/use-cases/toggle-notification.use-case.js";
import {
  SettingsUserNotFoundError,
  SettingsValidationError,
} from "../domain/errors/settings.errors.js";

test("ToggleNotificationUseCase returns the legacy successful response shape", async () => {
  const useCase = new ToggleNotificationUseCase({
    settingsUserRepository: {
      async updateNotificationPreference({ userId, state }) {
        assert.equal(userId, "user-1");
        assert.equal(state, true);
        return {
          userId,
          notificationState: undefined,
        };
      },
    },
  });

  const result = await useCase.execute({
    userId: "user-1",
    state: true,
  });

  assert.deepEqual(result, {
    message: "Notifications enabled successfully",
    data: {
      userId: "user-1",
      notificationState: undefined,
    },
    success: true,
  });
});

test("ToggleNotificationUseCase rejects missing user IDs", async () => {
  const useCase = new ToggleNotificationUseCase({
    settingsUserRepository: {
      async updateNotificationPreference() {
        assert.fail("updateNotificationPreference should not run without userId");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ state: true }),
    (error) => (
      error instanceof SettingsValidationError
      && error.message === "User ID is required"
    ),
  );
});

test("ToggleNotificationUseCase rejects non-boolean state values", async () => {
  const useCase = new ToggleNotificationUseCase({
    settingsUserRepository: {
      async updateNotificationPreference() {
        assert.fail("updateNotificationPreference should not run with invalid state");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      userId: "user-1",
      state: "true",
    }),
    (error) => (
      error instanceof SettingsValidationError
      && error.message === "State must be a boolean"
    ),
  );
});

test("ToggleNotificationUseCase rejects missing users", async () => {
  const useCase = new ToggleNotificationUseCase({
    settingsUserRepository: {
      async updateNotificationPreference({ userId, state }) {
        assert.equal(userId, "missing-user");
        assert.equal(state, false);
        return null;
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      userId: "missing-user",
      state: false,
    }),
    SettingsUserNotFoundError,
  );
});

test("ToggleNotificationUseCase lets repository errors propagate to the controller failure path", async () => {
  const useCase = new ToggleNotificationUseCase({
    settingsUserRepository: {
      async updateNotificationPreference() {
        throw new Error("Database unavailable");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      userId: "user-1",
      state: true,
    }),
    /Database unavailable/,
  );
});
