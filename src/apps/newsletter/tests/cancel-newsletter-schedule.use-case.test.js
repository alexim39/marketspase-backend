import test from "node:test";
import assert from "node:assert/strict";

import { CancelNewsletterScheduleUseCase } from "../application/use-cases/cancel-newsletter-schedule.use-case.js";
import { NewsletterActionRejectedError } from "../domain/errors/newsletter.errors.js";

test("CancelNewsletterScheduleUseCase returns the legacy successful cancel response shape", async () => {
  const cancelledNewsletter = {
    _id: "newsletter-1",
    status: "draft",
    scheduledDate: null,
    createdBy: {
      displayName: "Admin",
      email: "admin@example.com",
    },
  };

  const useCase = new CancelNewsletterScheduleUseCase({
    newsletterRepository: {
      async findById(id) {
        assert.equal(id, "newsletter-1");
        return {
          _id: id,
          status: "scheduled",
        };
      },
      async cancelScheduleById(id) {
        assert.equal(id, "newsletter-1");
        return cancelledNewsletter;
      },
    },
  });

  const result = await useCase.execute({ id: "newsletter-1" });

  assert.deepEqual(result, {
    success: true,
    data: cancelledNewsletter,
    message: "Scheduled newsletter cancelled successfully",
  });
});

test("CancelNewsletterScheduleUseCase rejects missing newsletters with the legacy message", async () => {
  const useCase = new CancelNewsletterScheduleUseCase({
    newsletterRepository: {
      async findById(id) {
        assert.equal(id, "newsletter-404");
        return null;
      },
      async cancelScheduleById() {
        assert.fail("cancelScheduleById should not run for missing newsletters");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "newsletter-404" }),
    (error) => (
      error instanceof NewsletterActionRejectedError
      && error.message === "Newsletter not found"
    ),
  );
});

test("CancelNewsletterScheduleUseCase rejects newsletters that are not scheduled", async () => {
  const useCase = new CancelNewsletterScheduleUseCase({
    newsletterRepository: {
      async findById(id) {
        assert.equal(id, "newsletter-draft");
        return {
          _id: id,
          status: "draft",
        };
      },
      async cancelScheduleById() {
        assert.fail("cancelScheduleById should not run for non-scheduled newsletters");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "newsletter-draft" }),
    (error) => (
      error instanceof NewsletterActionRejectedError
      && error.message === "Newsletter is not scheduled"
    ),
  );
});

test("CancelNewsletterScheduleUseCase maps repository errors to the legacy failed cancel message", async () => {
  const useCase = new CancelNewsletterScheduleUseCase({
    newsletterRepository: {
      async findById() {
        throw new Error("Database unavailable");
      },
      async cancelScheduleById() {
        return null;
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "newsletter-1" }),
    (error) => (
      error instanceof NewsletterActionRejectedError
      && error.message === "Failed to cancel scheduled newsletter"
    ),
  );
});
