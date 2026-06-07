import test from "node:test";
import assert from "node:assert/strict";

import {
  ACTION_TO_CATEGORY,
  ACTIVITY_ACTIONS_ARRAY,
  ACTIVITY_CATEGORIES,
  RESOURCE_TYPES_ARRAY,
} from "../models/activity/activity.constants.js";

test("user activity enum includes current production auth and forum actions", () => {
  const expectedActions = [
    "provider_profile_sync",
    "thread_unpinned",
    "pinned_threads_reordered",
    "thread_liked",
    "thread_unliked",
    "thread_locked",
    "thread_unlocked",
    "thread_viewed",
  ];

  for (const action of expectedActions) {
    assert.ok(ACTIVITY_ACTIONS_ARRAY.includes(action), `${action} should be a valid user activity action`);
  }

  assert.equal(ACTION_TO_CATEGORY.provider_profile_sync, ACTIVITY_CATEGORIES.PROFILE);
  assert.equal(ACTION_TO_CATEGORY.thread_unpinned, ACTIVITY_CATEGORIES.FORUM);
  assert.equal(ACTION_TO_CATEGORY.pinned_threads_reordered, ACTIVITY_CATEGORIES.FORUM);
});

test("user activity enum includes resource types emitted by wallet and settings flows", () => {
  assert.ok(RESOURCE_TYPES_ARRAY.includes("withdrawal"));
  assert.ok(RESOURCE_TYPES_ARRAY.includes("user_preferences"));
});
