import test from "node:test";
import assert from "node:assert/strict";

import { CreateOrUpdateTestimonialUseCase } from "../application/use-cases/create-or-update-testimonial.use-case.js";
import {
  SettingsUserNotFoundError,
  SettingsValidationError,
} from "../domain/errors/settings.errors.js";

test("CreateOrUpdateTestimonialUseCase updates an existing testimonial and returns the legacy response shape", async () => {
  const createdAt = new Date("2026-01-01T00:00:00.000Z");
  const useCase = new CreateOrUpdateTestimonialUseCase({
    settingsTestimonialRepository: {
      async findTestimonialUserById(userId) {
        assert.equal(userId, "user-1");
        return { _id: "user-1" };
      },
      async findActiveTestimonialByUser(userId) {
        assert.equal(userId, "user-1");
        return { _id: "testimonial-1" };
      },
      async updateTestimonialSubmission({ testimonialId, message, rating, status }) {
        assert.deepEqual({ testimonialId, message, rating, status }, {
          testimonialId: "testimonial-1",
          message: "MarketSpase helped my business grow",
          rating: 5,
          status: "pending",
        });
        return {
          _id: testimonialId,
          message,
          rating,
          status,
          createdAt,
        };
      },
      async createTestimonialSubmission() {
        assert.fail("createTestimonialSubmission should not run when testimonial exists");
      },
      async addUserTestimonialReference() {
        assert.fail("addUserTestimonialReference should not run when testimonial exists");
      },
    },
  });

  const result = await useCase.execute({
    userId: "user-1",
    message: "MarketSpase helped my business grow",
    rating: 5,
  });

  assert.deepEqual(result, {
    success: true,
    message: "Testimonial submitted successfully and pending approval",
    testimonial: {
      _id: "testimonial-1",
      message: "MarketSpase helped my business grow",
      rating: 5,
      status: "pending",
      createdAt,
    },
  });
});

test("CreateOrUpdateTestimonialUseCase creates a new testimonial and adds it to the user", async () => {
  const createdAt = new Date("2026-01-01T00:00:00.000Z");
  const addedReferences = [];

  const useCase = new CreateOrUpdateTestimonialUseCase({
    settingsTestimonialRepository: {
      async findTestimonialUserById() {
        return { _id: "user-1" };
      },
      async findActiveTestimonialByUser() {
        return null;
      },
      async updateTestimonialSubmission() {
        assert.fail("updateTestimonialSubmission should not run when testimonial is new");
      },
      async createTestimonialSubmission({ userId, message, rating, status }) {
        assert.deepEqual({ userId, message, rating, status }, {
          userId: "user-1",
          message: "Fresh review",
          rating: 4,
          status: "pending",
        });

        return {
          _id: "testimonial-2",
          message,
          rating,
          status,
          createdAt,
        };
      },
      async addUserTestimonialReference({ userId, testimonialId }) {
        addedReferences.push({ userId, testimonialId });
      },
    },
  });

  const result = await useCase.execute({
    userId: "user-1",
    message: "Fresh review",
    rating: 4,
  });

  assert.equal(result.testimonial._id, "testimonial-2");
  assert.deepEqual(addedReferences, [
    {
      userId: "user-1",
      testimonialId: "testimonial-2",
    },
  ]);
});

test("CreateOrUpdateTestimonialUseCase applies the legacy default rating", async () => {
  const useCase = new CreateOrUpdateTestimonialUseCase({
    settingsTestimonialRepository: {
      async findTestimonialUserById() {
        return { _id: "user-1" };
      },
      async findActiveTestimonialByUser() {
        return {
          _id: "testimonial-1",
        };
      },
      async updateTestimonialSubmission({ rating }) {
        assert.equal(rating, 5);
        return {
          _id: "testimonial-1",
          message: "Default rating",
          rating,
          status: "pending",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        };
      },
      async createTestimonialSubmission() {
        assert.fail("createTestimonialSubmission should not run when testimonial exists");
      },
      async addUserTestimonialReference() {
        assert.fail("addUserTestimonialReference should not run when testimonial exists");
      },
    },
  });

  const result = await useCase.execute({
    userId: "user-1",
    message: "Default rating",
  });

  assert.equal(result.testimonial.rating, 5);
});

test("CreateOrUpdateTestimonialUseCase rejects missing messages", async () => {
  const useCase = new CreateOrUpdateTestimonialUseCase({
    settingsTestimonialRepository: {
      async findTestimonialUserById() {
        assert.fail("findTestimonialUserById should not run without a message");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      userId: "user-1",
      rating: 5,
    }),
    (error) => (
      error instanceof SettingsValidationError
      && error.message === "Testimonial message is required"
    ),
  );
});

test("CreateOrUpdateTestimonialUseCase rejects ratings outside the legacy range", async () => {
  const useCase = new CreateOrUpdateTestimonialUseCase({
    settingsTestimonialRepository: {
      async findTestimonialUserById() {
        assert.fail("findTestimonialUserById should not run with an invalid rating");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      userId: "user-1",
      message: "Too high",
      rating: 6,
    }),
    (error) => (
      error instanceof SettingsValidationError
      && error.message === "Rating must be between 1 and 5"
    ),
  );
});

test("CreateOrUpdateTestimonialUseCase rejects missing users", async () => {
  const useCase = new CreateOrUpdateTestimonialUseCase({
    settingsTestimonialRepository: {
      async findTestimonialUserById(userId) {
        assert.equal(userId, "missing-user");
        return null;
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      userId: "missing-user",
      message: "Valid message",
      rating: 5,
    }),
    SettingsUserNotFoundError,
  );
});

test("CreateOrUpdateTestimonialUseCase lets repository errors propagate to the controller failure path", async () => {
  const useCase = new CreateOrUpdateTestimonialUseCase({
    settingsTestimonialRepository: {
      async findTestimonialUserById() {
        return { _id: "user-1" };
      },
      async findActiveTestimonialByUser() {
        throw new Error("Database unavailable");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      userId: "user-1",
      message: "Valid message",
      rating: 5,
    }),
    /Database unavailable/,
  );
});
