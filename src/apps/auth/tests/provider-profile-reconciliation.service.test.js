import test from "node:test";
import assert from "node:assert/strict";

import { buildExistingUserSyncUpdate } from "../domain/services/provider-profile-reconciliation.service.js";

test("buildExistingUserSyncUpdate returns only changed provider-managed fields", () => {
  const now = new Date("2026-05-19T09:00:00.000Z");
  const existingUser = {
    uid: "uid-1",
    displayName: "Ada",
    email: "ada@example.com",
    avatar: "https://example.com/old.png",
    authenticationMethod: "google.com",
    userDevice: "desktop",
  };

  const providerProfile = {
    uid: "uid-1",
    displayName: "Ada Lovelace",
    email: "ada@example.com",
    avatar: "https://example.com/new.png",
    authenticationMethod: "google.com",
    userDevice: "mobile",
  };

  const result = buildExistingUserSyncUpdate(existingUser, providerProfile, now);

  assert.deepEqual(result.syncedFields, ["displayName", "avatar", "userDevice"]);
  assert.deepEqual(result.setFields, {
    lastSeenAt: now,
    displayName: "Ada Lovelace",
    avatar: "https://example.com/new.png",
    userDevice: "mobile",
  });
});
