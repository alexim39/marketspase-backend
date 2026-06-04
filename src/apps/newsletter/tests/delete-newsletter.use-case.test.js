import test from "node:test";
import assert from "node:assert/strict";

import { DeleteNewsletterUseCase } from "../application/use-cases/delete-newsletter.use-case.js";
import { NewsletterNotFoundError } from "../domain/errors/newsletter.errors.js";

test("DeleteNewsletterUseCase returns the legacy successful delete response shape", async () => {
  const useCase = new DeleteNewsletterUseCase({
    newsletterRepository: {
      async softDeleteById(id) {
        assert.equal(id, "newsletter-1");
        return true;
      },
    },
  });

  const result = await useCase.execute({ id: "newsletter-1" });

  assert.deepEqual(result, {
    success: true,
    data: null,
    message: "Newsletter deleted successfully",
  });
});

test("DeleteNewsletterUseCase rejects missing newsletters", async () => {
  const useCase = new DeleteNewsletterUseCase({
    newsletterRepository: {
      async softDeleteById(id) {
        assert.equal(id, "newsletter-404");
        return false;
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "newsletter-404" }),
    NewsletterNotFoundError,
  );
});

test("DeleteNewsletterUseCase lets repository errors propagate to the controller failure path", async () => {
  const useCase = new DeleteNewsletterUseCase({
    newsletterRepository: {
      async softDeleteById() {
        throw new Error("Cast to ObjectId failed");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "bad-id" }),
    /Cast to ObjectId failed/,
  );
});
