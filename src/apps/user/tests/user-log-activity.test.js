import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { setupUserMethods } from "../models/user/user.methods.js";

const createActivityMethod = () => {
  const schema = new mongoose.Schema({});
  setupUserMethods(schema);
  return schema.methods.logActivity;
};

test("logActivity appends activity atomically for existing users", async () => {
  const logActivity = createActivityMethod();
  let capturedUpdate = null;
  const user = {
    _id: new mongoose.Types.ObjectId(),
    isNew: false,
    activitySettings: { enabled: true },
    isSelected: () => true,
    constructor: {
      updateOne: async (filter, update) => {
        capturedUpdate = { filter, update };
        return { acknowledged: true, modifiedCount: 1 };
      },
    },
    save: async () => {
      throw new Error("Existing user activity logging should not save the whole user document");
    },
  };

  const result = await logActivity.call(user, "thread_unpinned", "Thread was unpinned", {
    resourceType: "thread",
    resourceId: "thread-1",
  });

  assert.equal(result, user);
  assert.equal(capturedUpdate.filter._id, user._id);
  assert.equal(capturedUpdate.update.$push.activityLog.$each[0].action, "thread_unpinned");
  assert.equal(capturedUpdate.update.$push.activityLog.$each[0].resourceType, "thread");
  assert.equal(capturedUpdate.update.$push.activityLog.$position, 0);
  assert.equal(capturedUpdate.update.$push.activityLog.$slice, 1000);
});

test("logActivity normalizes unknown future actions instead of storing invalid enum values", async () => {
  const logActivity = createActivityMethod();
  let capturedActivity = null;
  const user = {
    _id: new mongoose.Types.ObjectId(),
    isNew: false,
    activitySettings: { enabled: true },
    isSelected: () => true,
    constructor: {
      updateOne: async (_filter, update) => {
        capturedActivity = update.$push.activityLog.$each[0];
        return { acknowledged: true, modifiedCount: 1 };
      },
    },
    save: async () => {
      throw new Error("Existing user activity logging should not save the whole user document");
    },
  };

  await logActivity.call(user, "future_action", "Future action happened", {
    resourceType: "future_resource",
    metadata: { source: "test" },
  });

  assert.equal(capturedActivity.action, "system_event");
  assert.equal(capturedActivity.resourceType, undefined);
  assert.deepEqual(capturedActivity.metadata, {
    source: "test",
    originalAction: "future_action",
    originalResourceType: "future_resource",
  });
});
