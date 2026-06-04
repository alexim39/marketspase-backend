import test from "node:test";
import assert from "node:assert/strict";

import { UpdateTestimonialStatusUseCase } from "../application/use-cases/update-testimonial-status.use-case.js";
import {
  SettingsTestimonialNotFoundError,
  SettingsValidationError,
} from "../domain/errors/settings.errors.js";

test("UpdateTestimonialStatusUseCase returns the legacy formatted testimonial response", async () => {
  const syncedUsers = [];
  const testimonial = {
    _id: "testimonial-1",
    status: "approved",
    reviewedBy: "admin-1",
    reviewedAt: new Date(),
    user: {
      _id: "user-1",
      username: "ada",
      name: "Ada",
      avatar: null,
    },
  };

  const useCase = new UpdateTestimonialStatusUseCase({
    settingsTestimonialRepository: {
      async updateTestimonialStatus({ testimonialId, status, reviewedBy, reviewedAt }) {
        assert.equal(testimonialId, "testimonial-1");
        assert.equal(status, "approved");
        assert.equal(reviewedBy, "admin-1");
        assert.ok(reviewedAt instanceof Date);
        return testimonial;
      },
      async syncUserTestimonials(userId) {
        syncedUsers.push(userId);
      },
    },
  });

  const result = await useCase.execute({
    testimonialId: "testimonial-1",
    status: "approved",
    reviewedBy: "admin-1",
  });

  assert.equal(result, testimonial);
  assert.deepEqual(syncedUsers, ["user-1"]);
});

test("UpdateTestimonialStatusUseCase supports pending and rejected statuses", async () => {
  const seenStatuses = [];
  const useCase = new UpdateTestimonialStatusUseCase({
    settingsTestimonialRepository: {
      async updateTestimonialStatus({ status }) {
        seenStatuses.push(status);
        return {
          _id: "testimonial-1",
          status,
        };
      },
      async syncUserTestimonials() {
        assert.fail("syncUserTestimonials should not run without a populated user");
      },
    },
  });

  await useCase.execute({
    testimonialId: "testimonial-1",
    status: "pending",
  });

  await useCase.execute({
    testimonialId: "testimonial-1",
    status: "rejected",
  });

  assert.deepEqual(seenStatuses, ["pending", "rejected"]);
});

test("UpdateTestimonialStatusUseCase rejects invalid statuses", async () => {
  const useCase = new UpdateTestimonialStatusUseCase({
    settingsTestimonialRepository: {
      async updateTestimonialStatus() {
        assert.fail("updateTestimonialStatus should not run for invalid statuses");
      },
      async syncUserTestimonials() {
        assert.fail("syncUserTestimonials should not run for invalid statuses");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      testimonialId: "testimonial-1",
      status: "archived",
    }),
    (error) => (
      error instanceof SettingsValidationError
      && error.message === "Invalid status value"
    ),
  );
});

test("UpdateTestimonialStatusUseCase rejects missing testimonials", async () => {
  const useCase = new UpdateTestimonialStatusUseCase({
    settingsTestimonialRepository: {
      async updateTestimonialStatus({ testimonialId }) {
        assert.equal(testimonialId, "missing-testimonial");
        return null;
      },
      async syncUserTestimonials() {
        assert.fail("syncUserTestimonials should not run for missing testimonials");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      testimonialId: "missing-testimonial",
      status: "approved",
    }),
    SettingsTestimonialNotFoundError,
  );
});

test("UpdateTestimonialStatusUseCase lets repository errors propagate to the controller failure path", async () => {
  const useCase = new UpdateTestimonialStatusUseCase({
    settingsTestimonialRepository: {
      async updateTestimonialStatus() {
        throw new Error("Database unavailable");
      },
      async syncUserTestimonials() {
        assert.fail("syncUserTestimonials should not run when update fails");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      testimonialId: "testimonial-1",
      status: "approved",
    }),
    /Database unavailable/,
  );
});
