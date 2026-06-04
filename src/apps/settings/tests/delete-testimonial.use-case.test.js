import test from "node:test";
import assert from "node:assert/strict";

import { DeleteTestimonialUseCase } from "../application/use-cases/delete-testimonial.use-case.js";
import { SettingsTestimonialNotFoundError } from "../domain/errors/settings.errors.js";

test("DeleteTestimonialUseCase returns the legacy successful delete response", async () => {
  const removedReferences = [];

  const useCase = new DeleteTestimonialUseCase({
    settingsTestimonialRepository: {
      async deleteTestimonial(testimonialId) {
        assert.equal(testimonialId, "testimonial-1");
        return {
          _id: "testimonial-1",
          user: "user-1",
        };
      },
      async removeUserTestimonialReference({ userId, testimonialId }) {
        removedReferences.push({ userId, testimonialId });
      },
    },
  });

  const result = await useCase.execute({
    testimonialId: "testimonial-1",
  });

  assert.deepEqual(result, {
    success: true,
    message: "Testimonial deleted successfully",
  });
  assert.deepEqual(removedReferences, [
    {
      userId: "user-1",
      testimonialId: "testimonial-1",
    },
  ]);
});

test("DeleteTestimonialUseCase skips user cleanup when deleted testimonial has no user", async () => {
  const useCase = new DeleteTestimonialUseCase({
    settingsTestimonialRepository: {
      async deleteTestimonial() {
        return {
          _id: "testimonial-1",
          user: null,
        };
      },
      async removeUserTestimonialReference() {
        assert.fail("removeUserTestimonialReference should not run without a user");
      },
    },
  });

  const result = await useCase.execute({
    testimonialId: "testimonial-1",
  });

  assert.equal(result.success, true);
});

test("DeleteTestimonialUseCase rejects missing testimonials", async () => {
  const useCase = new DeleteTestimonialUseCase({
    settingsTestimonialRepository: {
      async deleteTestimonial(testimonialId) {
        assert.equal(testimonialId, "missing-testimonial");
        return null;
      },
      async removeUserTestimonialReference() {
        assert.fail("removeUserTestimonialReference should not run for missing testimonials");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      testimonialId: "missing-testimonial",
    }),
    SettingsTestimonialNotFoundError,
  );
});

test("DeleteTestimonialUseCase lets delete repository errors propagate to the controller failure path", async () => {
  const useCase = new DeleteTestimonialUseCase({
    settingsTestimonialRepository: {
      async deleteTestimonial() {
        throw new Error("Database unavailable");
      },
      async removeUserTestimonialReference() {
        assert.fail("removeUserTestimonialReference should not run when delete fails");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      testimonialId: "testimonial-1",
    }),
    /Database unavailable/,
  );
});

test("DeleteTestimonialUseCase lets user cleanup errors propagate to the controller failure path", async () => {
  const useCase = new DeleteTestimonialUseCase({
    settingsTestimonialRepository: {
      async deleteTestimonial() {
        return {
          _id: "testimonial-1",
          user: "user-1",
        };
      },
      async removeUserTestimonialReference() {
        throw new Error("User cleanup failed");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      testimonialId: "testimonial-1",
    }),
    /User cleanup failed/,
  );
});
