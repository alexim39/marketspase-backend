import test from "node:test";
import assert from "node:assert/strict";

import { GetRandomDashboardTestimonialsUseCase } from "../application/use-cases/get-random-dashboard-testimonials.use-case.js";

test("GetRandomDashboardTestimonialsUseCase returns the legacy response shape", async () => {
  const testimonials = [
    {
      message: "MarketSpase helped my business grow",
      rating: 5,
      avatar: "avatar.png",
      name: "Ada Lovelace",
      location: "Lagos, Nigeria",
    },
  ];

  const useCase = new GetRandomDashboardTestimonialsUseCase({
    settingsTestimonialRepository: {
      async findRandomDashboardTestimonials(count) {
        assert.equal(count, 4);
        return testimonials;
      },
    },
  });

  const result = await useCase.execute({
    count: "4",
  });

  assert.deepEqual(result, {
    data: testimonials,
    success: true,
  });
});

test("GetRandomDashboardTestimonialsUseCase defaults missing count to 10", async () => {
  const useCase = new GetRandomDashboardTestimonialsUseCase({
    settingsTestimonialRepository: {
      async findRandomDashboardTestimonials(count) {
        assert.equal(count, 10);
        return [];
      },
    },
  });

  const result = await useCase.execute({});

  assert.deepEqual(result, {
    data: [],
    success: true,
  });
});

test("GetRandomDashboardTestimonialsUseCase defaults invalid count to 10", async () => {
  const useCase = new GetRandomDashboardTestimonialsUseCase({
    settingsTestimonialRepository: {
      async findRandomDashboardTestimonials(count) {
        assert.equal(count, 10);
        return [];
      },
    },
  });

  const result = await useCase.execute({
    count: "not-a-number",
  });

  assert.equal(result.success, true);
});

test("GetRandomDashboardTestimonialsUseCase preserves legacy zero-count fallback", async () => {
  const useCase = new GetRandomDashboardTestimonialsUseCase({
    settingsTestimonialRepository: {
      async findRandomDashboardTestimonials(count) {
        assert.equal(count, 10);
        return [];
      },
    },
  });

  const result = await useCase.execute({
    count: "0",
  });

  assert.equal(result.success, true);
});

test("GetRandomDashboardTestimonialsUseCase lets repository errors propagate to the controller failure path", async () => {
  const useCase = new GetRandomDashboardTestimonialsUseCase({
    settingsTestimonialRepository: {
      async findRandomDashboardTestimonials() {
        throw new Error("Database unavailable");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      count: "5",
    }),
    /Database unavailable/,
  );
});
