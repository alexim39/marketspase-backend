import test from "node:test";
import assert from "node:assert/strict";

import { UpdateTestimonialFeaturedStateUseCase } from "../application/use-cases/update-testimonial-featured-state.use-case.js";
import { SettingsTestimonialNotFoundError } from "../domain/errors/settings.errors.js";

test("UpdateTestimonialFeaturedStateUseCase returns the legacy formatted testimonial response", async () => {
  const testimonial = {
    _id: "testimonial-1",
    isFeatured: true,
    user: {
      _id: "user-1",
      username: "ada",
      name: "Ada",
      avatar: null,
    },
  };

  const useCase = new UpdateTestimonialFeaturedStateUseCase({
    settingsTestimonialRepository: {
      async updateTestimonialFeaturedState({ testimonialId, isFeatured }) {
        assert.equal(testimonialId, "testimonial-1");
        assert.equal(isFeatured, true);
        return testimonial;
      },
    },
  });

  const result = await useCase.execute({
    testimonialId: "testimonial-1",
    isFeatured: true,
  });

  assert.equal(result, testimonial);
});

test("UpdateTestimonialFeaturedStateUseCase supports false featured state", async () => {
  const useCase = new UpdateTestimonialFeaturedStateUseCase({
    settingsTestimonialRepository: {
      async updateTestimonialFeaturedState({ isFeatured }) {
        assert.equal(isFeatured, false);
        return {
          _id: "testimonial-1",
          isFeatured: false,
        };
      },
    },
  });

  const result = await useCase.execute({
    testimonialId: "testimonial-1",
    isFeatured: false,
  });

  assert.equal(result.isFeatured, false);
});

test("UpdateTestimonialFeaturedStateUseCase preserves legacy pass-through values", async () => {
  const useCase = new UpdateTestimonialFeaturedStateUseCase({
    settingsTestimonialRepository: {
      async updateTestimonialFeaturedState({ isFeatured }) {
        assert.equal(isFeatured, "true");
        return {
          _id: "testimonial-1",
          isFeatured: "true",
        };
      },
    },
  });

  const result = await useCase.execute({
    testimonialId: "testimonial-1",
    isFeatured: "true",
  });

  assert.equal(result.isFeatured, "true");
});

test("UpdateTestimonialFeaturedStateUseCase rejects missing testimonials", async () => {
  const useCase = new UpdateTestimonialFeaturedStateUseCase({
    settingsTestimonialRepository: {
      async updateTestimonialFeaturedState({ testimonialId }) {
        assert.equal(testimonialId, "missing-testimonial");
        return null;
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      testimonialId: "missing-testimonial",
      isFeatured: true,
    }),
    SettingsTestimonialNotFoundError,
  );
});

test("UpdateTestimonialFeaturedStateUseCase lets repository errors propagate to the controller failure path", async () => {
  const useCase = new UpdateTestimonialFeaturedStateUseCase({
    settingsTestimonialRepository: {
      async updateTestimonialFeaturedState() {
        throw new Error("Database unavailable");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      testimonialId: "testimonial-1",
      isFeatured: true,
    }),
    /Database unavailable/,
  );
});
