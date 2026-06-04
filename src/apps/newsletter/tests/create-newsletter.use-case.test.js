import test from "node:test";
import assert from "node:assert/strict";

import { CreateNewsletterUseCase } from "../application/use-cases/create-newsletter.use-case.js";
import { NewsletterActionRejectedError } from "../domain/errors/newsletter.errors.js";

test("CreateNewsletterUseCase returns the legacy successful create response shape", async () => {
  const newsletterData = {
    title: "May Newsletter",
    subject: "MarketSpase May Update",
    content: "Hello from MarketSpase",
    createdBy: "admin-1",
  };
  const createdNewsletter = {
    _id: "newsletter-1",
    ...newsletterData,
    createdBy: {
      displayName: "Admin",
      email: "admin@example.com",
    },
  };

  const useCase = new CreateNewsletterUseCase({
    newsletterRepository: {
      async create(data) {
        assert.equal(data, newsletterData);
        return createdNewsletter;
      },
    },
  });

  const result = await useCase.execute({ newsletterData });

  assert.deepEqual(result, {
    success: true,
    data: createdNewsletter,
    message: "Newsletter created successfully",
  });
});

test("CreateNewsletterUseCase rejects missing subject or content with the legacy message", async () => {
  const useCase = new CreateNewsletterUseCase({
    newsletterRepository: {
      async create() {
        assert.fail("create should not run when required fields are missing");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      newsletterData: {
        subject: "Incomplete newsletter",
      },
    }),
    (error) => (
      error instanceof NewsletterActionRejectedError
      && error.message === "Subject and content are required"
    ),
  );
});

test("CreateNewsletterUseCase lets repository errors propagate to the controller failure path", async () => {
  const useCase = new CreateNewsletterUseCase({
    newsletterRepository: {
      async create() {
        throw new Error("Newsletter validation failed");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      newsletterData: {
        subject: "MarketSpase May Update",
        content: "Hello from MarketSpase",
      },
    }),
    /Newsletter validation failed/,
  );
});
