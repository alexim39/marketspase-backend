import test from "node:test";
import assert from "node:assert/strict";

import { DuplicateNewsletterUseCase } from "../application/use-cases/duplicate-newsletter.use-case.js";
import { NewsletterNotFoundError } from "../domain/errors/newsletter.errors.js";

test("DuplicateNewsletterUseCase returns the legacy successful duplicate response shape", async () => {
  const duplicatedNewsletter = {
    _id: "newsletter-copy",
    title: "Weekly Update (Copy)",
    subject: "MarketSpase Update (Copy)",
    status: "draft",
    sendOption: "draft",
    openRate: 0,
    clickRate: 0,
  };

  const useCase = new DuplicateNewsletterUseCase({
    newsletterRepository: {
      async duplicateById(id) {
        assert.equal(id, "newsletter-1");
        return duplicatedNewsletter;
      },
    },
  });

  const result = await useCase.execute({ id: "newsletter-1" });

  assert.deepEqual(result, {
    success: true,
    data: duplicatedNewsletter,
    message: "Newsletter duplicated successfully",
  });
});

test("DuplicateNewsletterUseCase rejects missing newsletters", async () => {
  const useCase = new DuplicateNewsletterUseCase({
    newsletterRepository: {
      async duplicateById(id) {
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

test("DuplicateNewsletterUseCase lets repository errors propagate to the controller failure path", async () => {
  const useCase = new DuplicateNewsletterUseCase({
    newsletterRepository: {
      async duplicateById() {
        throw new Error("Invalid newsletter ID format");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "bad-id" }),
    /Invalid newsletter ID format/,
  );
});
