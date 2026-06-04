import test from "node:test";
import assert from "node:assert/strict";

import { SendNewsletterUseCase } from "../application/use-cases/send-newsletter.use-case.js";
import { NewsletterActionRejectedError } from "../domain/errors/newsletter.errors.js";

const createNewsletter = (overrides = {}) => ({
  _id: "newsletter-1",
  subject: "MarketSpase Update",
  content: "Hello from MarketSpase",
  recipientType: "external",
  externalEmails: ["ada@example.com"],
  status: "draft",
  ...overrides,
});

test("SendNewsletterUseCase sends to recipients and returns the legacy successful response shape", async () => {
  const newsletter = createNewsletter();
  const recipients = [{ email: "ada@example.com", displayName: "Ada", role: "external" }];
  const sentNewsletter = { ...newsletter, status: "sent", actualRecipients: 1 };
  const deliveryStatuses = [];
  const emailSends = [];

  const useCase = new SendNewsletterUseCase({
    newsletterRepository: {
      async findById(id) {
        assert.equal(id, "newsletter-1");
        return newsletter;
      },
      async markSendingById(id, estimatedRecipients) {
        assert.equal(id, "newsletter-1");
        assert.equal(estimatedRecipients, 1);
        return { ...newsletter, status: "sending", estimatedRecipients };
      },
      async addDeliveryStatusById(id, deliveryStatus) {
        assert.equal(id, "newsletter-1");
        deliveryStatuses.push(deliveryStatus);
      },
      async markSentById(id, actualRecipients) {
        assert.equal(id, "newsletter-1");
        assert.equal(actualRecipients, 1);
        return sentNewsletter;
      },
      async markFailedById() {
        assert.fail("markFailedById should not run for successful sends");
      },
    },
    recipientRepository: {
      async findRecipients(recipientType, externalEmails) {
        assert.equal(recipientType, "external");
        assert.deepEqual(externalEmails, ["ada@example.com"]);
        return recipients;
      },
    },
    emailGateway: {
      async sendNewsletter({ recipient }) {
        emailSends.push(recipient.email);
      },
    },
  });

  const result = await useCase.execute({ id: "newsletter-1" });

  assert.deepEqual(result, {
    success: true,
    data: sentNewsletter,
    message: "Newsletter sent successfully",
  });
  assert.deepEqual(emailSends, ["ada@example.com"]);
  assert.equal(deliveryStatuses.length, 1);
  assert.equal(deliveryStatuses[0].email, "ada@example.com");
  assert.equal(deliveryStatuses[0].status, "sent");
  assert.equal(deliveryStatuses[0].serviceProvider, "sendgrid");
});

test("SendNewsletterUseCase rejects already sent newsletters with the legacy message", async () => {
  const useCase = new SendNewsletterUseCase({
    newsletterRepository: {
      async findById() {
        return createNewsletter({ status: "sent" });
      },
      async markFailedById() {
        assert.fail("markFailedById should not run for business rejections");
      },
    },
    recipientRepository: {
      async findRecipients() {
        assert.fail("findRecipients should not run for already sent newsletters");
      },
    },
    emailGateway: {
      async sendNewsletter() {
        assert.fail("sendNewsletter should not run for already sent newsletters");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "newsletter-1" }),
    (error) => (
      error instanceof NewsletterActionRejectedError
      && error.message === "Newsletter has already been sent"
    ),
  );
});

test("SendNewsletterUseCase rejects newsletters with no recipients", async () => {
  const useCase = new SendNewsletterUseCase({
    newsletterRepository: {
      async findById() {
        return createNewsletter();
      },
      async markFailedById() {
        assert.fail("markFailedById should not run when no recipients are found");
      },
    },
    recipientRepository: {
      async findRecipients() {
        return [];
      },
    },
    emailGateway: {
      async sendNewsletter() {
        assert.fail("sendNewsletter should not run without recipients");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "newsletter-1" }),
    (error) => (
      error instanceof NewsletterActionRejectedError
      && error.message === "No recipients found for this newsletter"
    ),
  );
});

test("SendNewsletterUseCase records failed delivery for a recipient and still completes", async () => {
  const newsletter = createNewsletter();
  const deliveryStatuses = [];

  const useCase = new SendNewsletterUseCase({
    newsletterRepository: {
      async findById() {
        return newsletter;
      },
      async markSendingById() {
        return { ...newsletter, status: "sending" };
      },
      async addDeliveryStatusById(id, deliveryStatus) {
        assert.equal(id, "newsletter-1");
        deliveryStatuses.push(deliveryStatus);
      },
      async markSentById() {
        return { ...newsletter, status: "sent" };
      },
      async markFailedById() {
        assert.fail("markFailedById should not run when failed recipient status is recorded");
      },
    },
    recipientRepository: {
      async findRecipients() {
        return [{ email: "ada@example.com", displayName: "Ada", role: "external" }];
      },
    },
    emailGateway: {
      async sendNewsletter() {
        throw new Error("SMTP rejected recipient");
      },
    },
  });

  const result = await useCase.execute({ id: "newsletter-1" });

  assert.equal(result.success, true);
  assert.equal(deliveryStatuses.length, 1);
  assert.deepEqual(deliveryStatuses[0], {
    email: "ada@example.com",
    status: "failed",
    failureReason: "SMTP rejected recipient",
    serviceProvider: "sendgrid",
  });
});

test("SendNewsletterUseCase marks newsletter failed when the send pipeline fails", async () => {
  const newsletter = createNewsletter();
  let markedFailed = false;

  const useCase = new SendNewsletterUseCase({
    newsletterRepository: {
      async findById() {
        return newsletter;
      },
      async markSendingById() {
        return { ...newsletter, status: "sending" };
      },
      async addDeliveryStatusById() {
        throw new Error("Could not write delivery status");
      },
      async markSentById() {
        assert.fail("markSentById should not run when delivery status write fails");
      },
      async markFailedById(id) {
        assert.equal(id, "newsletter-1");
        markedFailed = true;
      },
    },
    recipientRepository: {
      async findRecipients() {
        return [{ email: "ada@example.com", displayName: "Ada", role: "external" }];
      },
    },
    emailGateway: {
      async sendNewsletter() {},
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "newsletter-1" }),
    (error) => (
      error instanceof NewsletterActionRejectedError
      && error.message === "Failed to send newsletter"
    ),
  );
  assert.equal(markedFailed, true);
});
