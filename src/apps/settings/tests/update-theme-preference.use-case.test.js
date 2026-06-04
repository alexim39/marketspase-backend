import test from "node:test";
import assert from "node:assert/strict";

import { UpdateThemePreferenceUseCase } from "../application/use-cases/update-theme-preference.use-case.js";
import {
  SettingsUserNotFoundError,
  SettingsValidationError,
} from "../domain/errors/settings.errors.js";

test("UpdateThemePreferenceUseCase returns the legacy successful response shape", async () => {
  const theme = {
    darkMode: true,
    highContrast: false,
    systemDefault: false,
  };

  const useCase = new UpdateThemePreferenceUseCase({
    settingsUserRepository: {
      async updateThemePreference({ userId, theme: submittedTheme }) {
        assert.equal(userId, "user-1");
        assert.equal(submittedTheme, theme);
        return {
          theme,
        };
      },
    },
  });

  const result = await useCase.execute({
    userId: "user-1",
    preferences: {
      theme,
    },
  });

  assert.deepEqual(result, {
    success: true,
    message: "Theme preferences updated successfully",
    data: {
      theme,
    },
  });
});

test("UpdateThemePreferenceUseCase rejects missing user IDs", async () => {
  const useCase = new UpdateThemePreferenceUseCase({
    settingsUserRepository: {
      async updateThemePreference() {
        assert.fail("updateThemePreference should not run without a userId");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      preferences: {
        theme: { darkMode: true },
      },
    }),
    (error) => (
      error instanceof SettingsValidationError
      && error.message === "User ID is required"
    ),
  );
});

test("UpdateThemePreferenceUseCase rejects missing theme preferences", async () => {
  const useCase = new UpdateThemePreferenceUseCase({
    settingsUserRepository: {
      async updateThemePreference() {
        assert.fail("updateThemePreference should not run without theme preferences");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      userId: "user-1",
      preferences: {},
    }),
    (error) => (
      error instanceof SettingsValidationError
      && error.message === "Theme preferences are required"
    ),
  );
});

test("UpdateThemePreferenceUseCase rejects missing users", async () => {
  const useCase = new UpdateThemePreferenceUseCase({
    settingsUserRepository: {
      async updateThemePreference({ userId }) {
        assert.equal(userId, "missing-user");
        return null;
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      userId: "missing-user",
      preferences: {
        theme: { darkMode: true },
      },
    }),
    SettingsUserNotFoundError,
  );
});

test("UpdateThemePreferenceUseCase lets repository errors propagate to the controller failure path", async () => {
  const useCase = new UpdateThemePreferenceUseCase({
    settingsUserRepository: {
      async updateThemePreference() {
        throw new Error("Validation failed");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      userId: "user-1",
      preferences: {
        theme: { darkMode: true },
      },
    }),
    /Validation failed/,
  );
});
