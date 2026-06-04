import test from "node:test";
import assert from "node:assert/strict";

import { GetNewsletterUseCase } from "../application/use-cases/get-newsletter.use-case.js";
import { NewsletterNotFoundError } from "../domain/errors/newsletter.errors.js";

test("GetNewsletterUseCase returns the legacy newsletter detail response shape", async () => {
  const newsletter = {
    _id: "newsletter-1",
    title: "Weekly Update",
    createdBy: {
      displayName: "Admin",
      email: "admin@example.com",
    },
  };

  const useCase = new GetNewsletterUseCase({
    newsletterRepository: {
      async findById(id) {
        assert.equal(id, "newsletter-1");
        return newsletter;
      },
    },
  });

  const result = await useCase.execute({ id: "newsletter-1" });

  assert.deepEqual(result, {
    success: true,
    data: newsletter,
    message: "Newsletter retrieved successfully",
  });
});

test("GetNewsletterUseCase rejects missing newsletters", async () => {
  const useCase = new GetNewsletterUseCase({
    newsletterRepository: {
      async findById(id) {
        assert.equal(id, "newsletter-404");
        return null;
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "newsletter-404" }),
    NewsletterNotFoundError,
  );
});

test("GetNewsletterUseCase lets repository errors propagate to the controller failure path", async () => {
  const useCase = new GetNewsletterUseCase({
    newsletterRepository: {
      async findById() {
        throw new Error("Cast to ObjectId failed");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "bad-id" }),
    /Cast to ObjectId failed/,
  );
});
