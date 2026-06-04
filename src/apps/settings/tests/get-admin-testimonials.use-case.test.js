import test from "node:test";
import assert from "node:assert/strict";

import { GetAdminTestimonialsUseCase } from "../application/use-cases/get-admin-testimonials.use-case.js";

test("GetAdminTestimonialsUseCase returns the legacy admin listing response shape", async () => {
  const testimonials = [
    {
      _id: "testimonial-1",
      message: "MarketSpase helped my store grow",
      status: "approved",
      rating: 5,
    },
  ];

  const useCase = new GetAdminTestimonialsUseCase({
    settingsTestimonialRepository: {
      async findAdminTestimonials({ filter, skip, limit }) {
        assert.deepEqual(filter, {});
        assert.equal(skip, 0);
        assert.equal(limit, 10);

        return {
          testimonials,
          total: 1,
        };
      },
    },
  });

  const result = await useCase.execute({});

  assert.deepEqual(result, {
    data: testimonials,
    totalPages: 1,
    currentPage: 1,
    total: 1,
    success: true,
    message: "Testimonials found",
  });
});

test("GetAdminTestimonialsUseCase keeps all status out of the filter", async () => {
  const useCase = new GetAdminTestimonialsUseCase({
    settingsTestimonialRepository: {
      async findAdminTestimonials({ filter }) {
        assert.deepEqual(filter, {});
        return {
          testimonials: [],
          total: 0,
        };
      },
    },
  });

  const result = await useCase.execute({
    status: "all",
  });

  assert.equal(result.success, true);
  assert.equal(result.total, 0);
});

test("GetAdminTestimonialsUseCase builds the legacy status, rating, and featured filters", async () => {
  const useCase = new GetAdminTestimonialsUseCase({
    settingsTestimonialRepository: {
      async findAdminTestimonials({ filter, skip, limit }) {
        assert.deepEqual(filter, {
          status: "pending",
          rating: 4,
          isFeatured: true,
        });
        assert.equal(skip, 20);
        assert.equal(limit, 20);

        return {
          testimonials: [],
          total: 44,
        };
      },
    },
  });

  const result = await useCase.execute({
    status: "pending",
    rating: "4",
    featured: "true",
    page: "2",
    limit: "20",
  });

  assert.equal(result.totalPages, 3);
  assert.equal(result.currentPage, 2);
});

test("GetAdminTestimonialsUseCase treats any non-true featured query as false", async () => {
  const useCase = new GetAdminTestimonialsUseCase({
    settingsTestimonialRepository: {
      async findAdminTestimonials({ filter }) {
        assert.deepEqual(filter, {
          isFeatured: false,
        });

        return {
          testimonials: [],
          total: 0,
        };
      },
    },
  });

  const result = await useCase.execute({
    featured: "all",
  });

  assert.equal(result.success, true);
});

test("GetAdminTestimonialsUseCase lets repository errors propagate to the controller failure path", async () => {
  const useCase = new GetAdminTestimonialsUseCase({
    settingsTestimonialRepository: {
      async findAdminTestimonials() {
        throw new Error("Database unavailable");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({}),
    /Database unavailable/,
  );
});
