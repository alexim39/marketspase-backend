import test from "node:test";
import assert from "node:assert/strict";

import { UpdateNewsletterUseCase } from "../application/use-cases/update-newsletter.use-case.js";
import { NewsletterNotFoundError } from "../domain/errors/newsletter.errors.js";

test("UpdateNewsletterUseCase returns the legacy successful update response shape", async () => {
  const newsletterData = {
    title: "May Newsletter",
    subject: "MarketSpase May Update",
  };
  const updatedNewsletter = {
    _id: "newsletter-1",
    ...newsletterData,
    createdBy: {
      displayName: "Admin",
      email: "admin@example.com",
    },
  };

  const useCase = new UpdateNewsletterUseCase({
    newsletterRepository: {
      async updateById(id, data) {
        assert.equal(id, "newsletter-1");
        assert.equal(data, newsletterData);
        return updatedNewsletter;
      },
    },
  });

  const result = await useCase.execute({
    id: "newsletter-1",
    newsletterData,
  });

  assert.deepEqual(result, {
    success: true,
    data: updatedNewsletter,
    message: "Newsletter updated successfully",
  });
});

test("UpdateNewsletterUseCase rejects missing newsletters", async () => {
  const useCase = new UpdateNewsletterUseCase({
    newsletterRepository: {
      async updateById(id) {
        assert.equal(id, "newsletter-404");
        return null;
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      id: "newsletter-404",
      newsletterData: { title: "Missing" },
    }),
    NewsletterNotFoundError,
  );
});

test("UpdateNewsletterUseCase lets repository errors propagate to the controller failure path", async () => {
  const useCase = new UpdateNewsletterUseCase({
    newsletterRepository: {
      async updateById() {
        throw new Error("Validation failed");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      id: "newsletter-1",
      newsletterData: { subject: "" },
    }),
    /Validation failed/,
  );
});
