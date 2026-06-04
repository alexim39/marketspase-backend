import test from "node:test";
import assert from "node:assert/strict";

import { SubmitContactUseCase } from "../application/use-cases/submit-contact.use-case.js";
import {
  ContactAuthenticationRequiredError,
  ContactUserNotFoundError,
} from "../domain/errors/contact.errors.js";

test("SubmitContactUseCase creates a contact with the same submit contract fields", async () => {
  const createdContacts = [];
  const touchedUsers = [];

  const useCase = new SubmitContactUseCase({
    requestIdFactory: () => "12345678",
    contactUserRepository: {
      async findById(userId) {
        assert.equal(userId, "user-1");
        return {
          _id: "user-1",
          email: "owner@example.com",
        };
      },
      async touchLastSeen(userId) {
        touchedUsers.push(userId);
      },
    },
    contactRepository: {
      async create(contactData) {
        createdContacts.push(contactData);
        return {
          _id: "contact-1",
          ...contactData,
        };
      },
    },
  });

  const result = await useCase.execute({
    userId: "user-1",
    reason: "technical",
    subject: "Cannot access dashboard",
    message: "The dashboard keeps loading.",
    userEmail: "fallback@example.com",
  });

  assert.deepEqual(createdContacts, [
    {
      user: "user-1",
      reason: "technical",
      subject: "Cannot access dashboard",
      message: "The dashboard keeps loading.",
      requestID: "12345678",
      userEmail: "owner@example.com",
    },
  ]);
  assert.deepEqual(touchedUsers, ["user-1"]);
  assert.equal(result.contact._id, "contact-1");
  assert.equal(result.events[0].type, "contact.submitted");
});

test("SubmitContactUseCase uses submitted email when user record has no email", async () => {
  const useCase = new SubmitContactUseCase({
    requestIdFactory: () => "87654321",
    contactUserRepository: {
      async findById() {
        return { _id: "user-2" };
      },
      async touchLastSeen() {},
    },
    contactRepository: {
      async create(contactData) {
        return contactData;
      },
    },
  });

  const result = await useCase.execute({
    userId: "user-2",
    reason: "general",
    subject: "Hello",
    message: "Please contact me.",
    userEmail: "submitted@example.com",
  });

  assert.equal(result.contact.userEmail, "submitted@example.com");
  assert.equal(result.contact.requestID, "87654321");
});

test("SubmitContactUseCase rejects missing authentication before repository access", async () => {
  const useCase = new SubmitContactUseCase({
    contactUserRepository: {
      async findById() {
        throw new Error("Should not query user repository without authentication.");
      },
      async touchLastSeen() {},
    },
    contactRepository: {
      async create() {
        throw new Error("Should not create contact without authentication.");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ reason: "general" }),
    ContactAuthenticationRequiredError,
  );
});

test("SubmitContactUseCase rejects unknown users", async () => {
  const useCase = new SubmitContactUseCase({
    contactUserRepository: {
      async findById() {
        return null;
      },
      async touchLastSeen() {
        throw new Error("Should not touch missing user.");
      },
    },
    contactRepository: {
      async create() {
        throw new Error("Should not create contact for missing user.");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ userId: "missing-user", reason: "general" }),
    ContactUserNotFoundError,
  );
});
