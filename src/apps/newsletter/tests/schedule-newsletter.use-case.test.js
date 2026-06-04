import test from "node:test";
import assert from "node:assert/strict";

import { ScheduleNewsletterUseCase } from "../application/use-cases/schedule-newsletter.use-case.js";
import { NewsletterActionRejectedError } from "../domain/errors/newsletter.errors.js";

test("ScheduleNewsletterUseCase returns the legacy successful schedule response shape", async () => {
  const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const scheduledNewsletter = {
    _id: "newsletter-1",
    status: "scheduled",
    scheduledDate: new Date(futureDate),
    createdBy: {
      displayName: "Admin",
      email: "admin@example.com",
    },
  };

  const useCase = new ScheduleNewsletterUseCase({
    newsletterRepository: {
      async findById(id) {
        assert.equal(id, "newsletter-1");
        return {
          _id: id,
          status: "draft",
        };
      },
      async scheduleById(id, scheduledDate) {
        assert.equal(id, "newsletter-1");
        assert.equal(scheduledDate.getTime(), new Date(futureDate).getTime());
        return scheduledNewsletter;
      },
    },
  });

  const result = await useCase.execute({
    id: "newsletter-1",
    scheduledDate: futureDate,
  });

  assert.deepEqual(result, {
    success: true,
    data: scheduledNewsletter,
    message: "Newsletter scheduled successfully",
  });
});

test("ScheduleNewsletterUseCase rejects missing scheduled dates with the legacy message", async () => {
  const useCase = new ScheduleNewsletterUseCase({
    newsletterRepository: {
      async findById() {
        assert.fail("findById should not run when scheduledDate is missing");
      },
      async scheduleById() {
        assert.fail("scheduleById should not run when scheduledDate is missing");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "newsletter-1" }),
    (error) => (
      error instanceof NewsletterActionRejectedError
      && error.message === "Scheduled date is required"
    ),
  );
});

test("ScheduleNewsletterUseCase rejects missing newsletters with the legacy message", async () => {
  const useCase = new ScheduleNewsletterUseCase({
    newsletterRepository: {
      async findById(id) {
        assert.equal(id, "newsletter-404");
        return null;
      },
      async scheduleById() {
        assert.fail("scheduleById should not run for missing newsletters");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      id: "newsletter-404",
      scheduledDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }),
    (error) => (
      error instanceof NewsletterActionRejectedError
      && error.message === "Newsletter not found"
    ),
  );
});

test("ScheduleNewsletterUseCase rejects dates that are not in the future", async () => {
  const useCase = new ScheduleNewsletterUseCase({
    newsletterRepository: {
      async findById(id) {
        assert.equal(id, "newsletter-1");
        return {
          _id: id,
          status: "draft",
        };
      },
      async scheduleById() {
        assert.fail("scheduleById should not run for past dates");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      id: "newsletter-1",
      scheduledDate: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    }),
    (error) => (
      error instanceof NewsletterActionRejectedError
      && error.message === "Scheduled date must be in the future"
    ),
  );
});

test("ScheduleNewsletterUseCase maps repository errors to the legacy failed schedule message", async () => {
  const useCase = new ScheduleNewsletterUseCase({
    newsletterRepository: {
      async findById() {
        throw new Error("Database unavailable");
      },
      async scheduleById() {
        return null;
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      id: "newsletter-1",
      scheduledDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }),
    (error) => (
      error instanceof NewsletterActionRejectedError
      && error.message === "Failed to schedule newsletter"
    ),
  );
});
