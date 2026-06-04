import test from "node:test";
import assert from "node:assert/strict";

import { UpdateContactPriorityUseCase } from "../application/use-cases/update-contact-priority.use-case.js";
import {
  ContactInvalidIdError,
  ContactInvalidPriorityValueError,
  ContactNotFoundError,
} from "../domain/errors/contact.errors.js";

test("UpdateContactPriorityUseCase updates priority and records the admin note", async () => {
  const notes = [];

  const useCase = new UpdateContactPriorityUseCase({
    isValidContactId: (id) => id === "contact-1",
    contactRepository: {
      async setPriorityById({ contactId, priority }) {
        assert.equal(contactId, "contact-1");
        assert.equal(priority, "urgent");
        return {
          _id: "contact-1",
          user: "user-1",
          userEmail: "ada@example.com",
          priority,
        };
      },
      async addAdminNote(contact, adminId, note) {
        notes.push({ contactId: contact._id, adminId, note });
      },
    },
    contactUserRepository: {
      async findContactUsersByIds(userIds) {
        assert.deepEqual(userIds, ["user-1"]);
        return [
          {
            _id: "user-1",
            username: "adalovelace",
            displayName: "Ada Lovelace",
            avatar: "/ada.png",
            email: "ada@example.com",
          },
        ];
      },
    },
  });

  const result = await useCase.execute({
    id: "contact-1",
    priority: "urgent",
    adminId: "admin-1",
  });

  assert.equal(result.success, true);
  assert.equal(result.message, "Contact priority updated to urgent");
  assert.equal(result.data.priority, "urgent");
  assert.equal(result.data.user.displayName, "Ada Lovelace");
  assert.deepEqual(notes, [
    {
      contactId: "contact-1",
      adminId: "admin-1",
      note: "Priority changed to urgent",
    },
  ]);
});

test("UpdateContactPriorityUseCase preserves unknown user fallback", async () => {
  const notes = [];

  const useCase = new UpdateContactPriorityUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async setPriorityById({ priority }) {
        return {
          _id: "contact-2",
          user: "missing-user",
          userEmail: "missing@example.com",
          priority,
        };
      },
      async addAdminNote(contact, adminId, note) {
        notes.push({ contactId: contact._id, adminId, note });
      },
    },
    contactUserRepository: {
      async findContactUsersByIds() {
        return [];
      },
    },
  });

  const result = await useCase.execute({
    id: "contact-2",
    priority: "low",
    adminId: "admin-2",
  });

  assert.deepEqual(result.data.user, {
    _id: "missing-user",
    username: "Unknown",
    displayName: "Unknown User",
    avatar: "/img/avatar.png",
    email: "missing@example.com",
  });
  assert.deepEqual(notes, [
    {
      contactId: "contact-2",
      adminId: "admin-2",
      note: "Priority changed to low",
    },
  ]);
});

test("UpdateContactPriorityUseCase rejects invalid contact IDs before mutation", async () => {
  const useCase = new UpdateContactPriorityUseCase({
    isValidContactId: () => false,
    contactRepository: {
      async setPriorityById() {
        throw new Error("Should not update invalid IDs.");
      },
      async addAdminNote() {
        throw new Error("Should not write notes for invalid IDs.");
      },
    },
    contactUserRepository: {
      async findContactUsersByIds() {
        throw new Error("Should not query users for invalid IDs.");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "bad-id", priority: "high" }),
    ContactInvalidIdError,
  );
});

test("UpdateContactPriorityUseCase rejects invalid priority values", async () => {
  const useCase = new UpdateContactPriorityUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async setPriorityById() {
        throw new Error("Should not update invalid priority values.");
      },
      async addAdminNote() {
        throw new Error("Should not write notes for invalid priority values.");
      },
    },
    contactUserRepository: {
      async findContactUsersByIds() {
        throw new Error("Should not query users for invalid priority values.");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "contact-1", priority: "critical" }),
    ContactInvalidPriorityValueError,
  );
});

test("UpdateContactPriorityUseCase rejects missing contacts", async () => {
  const useCase = new UpdateContactPriorityUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async setPriorityById() {
        return null;
      },
      async addAdminNote() {
        throw new Error("Should not write notes for missing contacts.");
      },
    },
    contactUserRepository: {
      async findContactUsersByIds() {
        throw new Error("Should not query users for missing contacts.");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "contact-404", priority: "medium" }),
    ContactNotFoundError,
  );
});
