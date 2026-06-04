import test from "node:test";
import assert from "node:assert/strict";

import { GetTestimonialsUseCase } from "../application/use-cases/get-testimonials.use-case.js";
import { SettingsValidationError } from "../domain/errors/settings.errors.js";

test("GetTestimonialsUseCase returns the legacy public listing response shape", async () => {
  const testimonials = [
    {
      _id: "testimonial-1",
      message: "MarketSpase helped my business grow",
      reactions: [],
    },
  ];

  const useCase = new GetTestimonialsUseCase({
    settingsTestimonialRepository: {
      async findTestimonials({ filter, skip, limit, sort }) {
        assert.deepEqual(filter, {
          status: "approved",
          isDeleted: false,
        });
        assert.equal(skip, 0);
        assert.equal(limit, 10);
        assert.deepEqual(sort, { createdAt: -1 });

        return {
          testimonials,
          total: 1,
        };
      },
    },
  });

  const result = await useCase.execute({});

  assert.deepEqual(result, {
    success: true,
    testimonials,
    pagination: {
      total: 1,
      page: 1,
      pages: 1,
      limit: 10,
    },
  });
});

test("GetTestimonialsUseCase builds the legacy status and pagination query", async () => {
  const useCase = new GetTestimonialsUseCase({
    settingsTestimonialRepository: {
      async findTestimonials({ filter, skip, limit, sort }) {
        assert.deepEqual(filter, {
          status: "pending",
          isDeleted: false,
        });
        assert.equal(skip, 40);
        assert.equal(limit, 20);
        assert.deepEqual(sort, { createdAt: -1 });

        return {
          testimonials: [],
          total: 45,
        };
      },
    },
  });

  const result = await useCase.execute({
    status: "pending",
    page: "3",
    limit: "20",
  });

  assert.deepEqual(result.pagination, {
    total: 45,
    page: 3,
    pages: 3,
    limit: 20,
  });
});

test("GetTestimonialsUseCase supports rejected testimonials", async () => {
  const useCase = new GetTestimonialsUseCase({
    settingsTestimonialRepository: {
      async findTestimonials({ filter }) {
        assert.equal(filter.status, "rejected");
        return {
          testimonials: [],
          total: 0,
        };
      },
    },
  });

  const result = await useCase.execute({
    status: "rejected",
  });

  assert.equal(result.success, true);
});

test("GetTestimonialsUseCase rejects invalid status filters", async () => {
  const useCase = new GetTestimonialsUseCase({
    settingsTestimonialRepository: {
      async findTestimonials() {
        assert.fail("findTestimonials should not run for invalid statuses");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      status: "all",
    }),
    (error) => (
      error instanceof SettingsValidationError
      && error.message === "Invalid status filter"
    ),
  );
});

test("GetTestimonialsUseCase lets repository errors propagate to the controller failure path", async () => {
  const useCase = new GetTestimonialsUseCase({
    settingsTestimonialRepository: {
      async findTestimonials() {
        throw new Error("Database unavailable");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({}),
    /Database unavailable/,
  );
});
