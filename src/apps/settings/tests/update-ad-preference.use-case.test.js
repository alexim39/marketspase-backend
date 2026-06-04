import test from "node:test";
import assert from "node:assert/strict";

import { UpdateAdPreferenceUseCase } from "../application/use-cases/update-ad-preference.use-case.js";
import {
  SettingsUserNotFoundError,
  SettingsValidationError,
} from "../domain/errors/settings.errors.js";

test("UpdateAdPreferenceUseCase returns the legacy successful response shape", async () => {
  const preferences = {
    categoryBasedAds: true,
    locationBasedAds: false,
    adCategories: ["Tech", "food", "tech", "  business  "],
  };

  const savedPreferences = {
    categoryBasedAds: true,
    locationBasedAds: false,
    adCategories: ["tech", "food", "business"],
  };

  const useCase = new UpdateAdPreferenceUseCase({
    settingsUserRepository: {
      async findPreferencesByUserId(userId) {
        assert.equal(userId, "user-1");
        return {
          categoryBasedAds: false,
          locationBasedAds: true,
          adCategories: [],
        };
      },
      async updateAdPreference({ userId, updateFields }) {
        assert.equal(userId, "user-1");
        assert.deepEqual(updateFields, {
          "preferences.categoryBasedAds": true,
          "preferences.locationBasedAds": false,
          "preferences.adCategories": ["tech", "food", "business"],
        });

        return {
          preferences: savedPreferences,
        };
      },
    },
  });

  const result = await useCase.execute({
    userId: "user-1",
    preferences,
  });

  assert.deepEqual(result, {
    success: true,
    message: "Ad preferences updated successfully",
    data: {
      preferences: savedPreferences,
    },
  });
});

test("UpdateAdPreferenceUseCase clears selected categories when category ads are disabled", async () => {
  const useCase = new UpdateAdPreferenceUseCase({
    settingsUserRepository: {
      async findPreferencesByUserId() {
        return {
          categoryBasedAds: true,
          adCategories: ["tech"],
        };
      },
      async updateAdPreference({ updateFields }) {
        assert.deepEqual(updateFields, {
          "preferences.categoryBasedAds": false,
          "preferences.adCategories": [],
        });

        return {
          preferences: {
            categoryBasedAds: false,
            adCategories: [],
          },
        };
      },
    },
  });

  const result = await useCase.execute({
    userId: "user-1",
    preferences: {
      categoryBasedAds: false,
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.data.preferences.categoryBasedAds, false);
  assert.deepEqual(result.data.preferences.adCategories, []);
});

test("UpdateAdPreferenceUseCase preserves legacy empty-payload behavior when category ads are already disabled", async () => {
  const useCase = new UpdateAdPreferenceUseCase({
    settingsUserRepository: {
      async findPreferencesByUserId() {
        return {
          categoryBasedAds: false,
          adCategories: ["tech"],
        };
      },
      async updateAdPreference({ updateFields }) {
        assert.deepEqual(updateFields, {
          "preferences.adCategories": [],
        });

        return {
          preferences: {
            categoryBasedAds: false,
            adCategories: [],
          },
        };
      },
    },
  });

  const result = await useCase.execute({
    userId: "user-1",
    preferences: {},
  });

  assert.equal(result.success, true);
});

test("UpdateAdPreferenceUseCase rejects missing user IDs", async () => {
  const useCase = new UpdateAdPreferenceUseCase({
    settingsUserRepository: {
      async findPreferencesByUserId() {
        assert.fail("findPreferencesByUserId should not run without a userId");
      },
      async updateAdPreference() {
        assert.fail("updateAdPreference should not run without a userId");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      preferences: {
        locationBasedAds: true,
      },
    }),
    (error) => (
      error instanceof SettingsValidationError
      && error.message === "User ID is required"
    ),
  );
});

test("UpdateAdPreferenceUseCase rejects missing preferences", async () => {
  const useCase = new UpdateAdPreferenceUseCase({
    settingsUserRepository: {
      async findPreferencesByUserId() {
        assert.fail("findPreferencesByUserId should not run without preferences");
      },
      async updateAdPreference() {
        assert.fail("updateAdPreference should not run without preferences");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      userId: "user-1",
    }),
    (error) => (
      error instanceof SettingsValidationError
      && error.message === "A valid preferences payload is required"
    ),
  );
});

test("UpdateAdPreferenceUseCase rejects non-array ad categories", async () => {
  const useCase = new UpdateAdPreferenceUseCase({
    settingsUserRepository: {
      async findPreferencesByUserId() {
        return {
          categoryBasedAds: true,
        };
      },
      async updateAdPreference() {
        assert.fail("updateAdPreference should not run with invalid categories");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      userId: "user-1",
      preferences: {
        adCategories: "tech",
      },
    }),
    (error) => (
      error instanceof SettingsValidationError
      && error.message === "Ad categories must be provided as an array"
    ),
  );
});

test("UpdateAdPreferenceUseCase rejects too many ad categories", async () => {
  const useCase = new UpdateAdPreferenceUseCase({
    settingsUserRepository: {
      async findPreferencesByUserId() {
        return {
          categoryBasedAds: true,
        };
      },
      async updateAdPreference() {
        assert.fail("updateAdPreference should not run with too many categories");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      userId: "user-1",
      preferences: {
        adCategories: ["tech", "food", "business", "travel", "health", "education", "sports"],
      },
    }),
    (error) => (
      error instanceof SettingsValidationError
      && error.message === "A maximum of 6 ad categories can be selected"
    ),
  );
});

test("UpdateAdPreferenceUseCase returns invalid category details", async () => {
  const useCase = new UpdateAdPreferenceUseCase({
    settingsUserRepository: {
      async findPreferencesByUserId() {
        return {
          categoryBasedAds: true,
        };
      },
      async updateAdPreference() {
        assert.fail("updateAdPreference should not run with invalid categories");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      userId: "user-1",
      preferences: {
        adCategories: ["tech", "not-real"],
      },
    }),
    (error) => (
      error instanceof SettingsValidationError
      && error.message === "One or more selected ad categories are invalid"
      && assert.deepEqual(error.details, { invalidCategories: ["not-real"] }) === undefined
    ),
  );
});

test("UpdateAdPreferenceUseCase rejects no-op updates when category ads remain enabled", async () => {
  const useCase = new UpdateAdPreferenceUseCase({
    settingsUserRepository: {
      async findPreferencesByUserId() {
        return {
          categoryBasedAds: true,
        };
      },
      async updateAdPreference() {
        assert.fail("updateAdPreference should not run for a no-op payload");
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
      && error.message === "No valid preference fields to update"
    ),
  );
});

test("UpdateAdPreferenceUseCase rejects missing users", async () => {
  const useCase = new UpdateAdPreferenceUseCase({
    settingsUserRepository: {
      async findPreferencesByUserId(userId) {
        assert.equal(userId, "missing-user");
        return null;
      },
      async updateAdPreference() {
        assert.fail("updateAdPreference should not run for missing users");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      userId: "missing-user",
      preferences: {
        locationBasedAds: true,
      },
    }),
    SettingsUserNotFoundError,
  );
});

test("UpdateAdPreferenceUseCase lets repository validation errors propagate to the controller", async () => {
  const useCase = new UpdateAdPreferenceUseCase({
    settingsUserRepository: {
      async findPreferencesByUserId() {
        return {
          categoryBasedAds: true,
        };
      },
      async updateAdPreference() {
        const error = new Error("Validation failed");
        error.name = "ValidationError";
        error.errors = {
          adCategories: {
            message: "A maximum of 6 ad categories can be selected",
          },
        };
        throw error;
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      userId: "user-1",
      preferences: {
        locationBasedAds: true,
      },
    }),
    (error) => (
      error.name === "ValidationError"
      && error.errors.adCategories.message === "A maximum of 6 ad categories can be selected"
    ),
  );
});
