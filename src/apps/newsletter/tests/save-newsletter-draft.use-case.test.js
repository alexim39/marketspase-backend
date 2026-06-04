import test from "node:test";
import assert from "node:assert/strict";

import { SaveNewsletterDraftUseCase } from "../application/use-cases/save-newsletter-draft.use-case.js";
import { NewsletterNotFoundError } from "../domain/errors/newsletter.errors.js";

test("SaveNewsletterDraftUseCase returns the legacy successful draft response shape", async () => {
  const draftNewsletter = {
    _id: "newsletter-1",
    status: "draft",
    scheduledDate: null,
    createdBy: {
      displayName: "Admin",
      email: "admin@example.com",
    },
  };

  const useCase = new SaveNewsletterDraftUseCase({
    newsletterRepository: {
      async saveAsDraftById(id) {
        assert.equal(id, "newsletter-1");
        return draftNewsletter;
      },
    },
  });

  const result = await useCase.execute({ id: "newsletter-1" });

  assert.deepEqual(result, {
    success: true,
    data: draftNewsletter,
    message: "Newsletter saved as draft successfully",
  });
});

test("SaveNewsletterDraftUseCase rejects missing newsletters", async () => {
  const useCase = new SaveNewsletterDraftUseCase({
    newsletterRepository: {
      async saveAsDraftById(id) {
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

test("SaveNewsletterDraftUseCase lets repository errors propagate to the controller failure path", async () => {
  const useCase = new SaveNewsletterDraftUseCase({
    newsletterRepository: {
      async saveAsDraftById() {
        throw new Error("Cast to ObjectId failed");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "bad-id" }),
    /Cast to ObjectId failed/,
  );
});
