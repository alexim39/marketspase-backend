import test from "node:test";
import assert from "node:assert/strict";

import { ToggleContactArchiveUseCase } from "../application/use-cases/toggle-contact-archive.use-case.js";
import {
  ContactInvalidArchiveValueError,
  ContactInvalidIdError,
  ContactNotFoundError,
} from "../domain/errors/contact.errors.js";

test("ToggleContactArchiveUseCase archives a contact and records the admin note", async () => {
  const notes = [];

  const useCase = new ToggleContactArchiveUseCase({
    isValidContactId: (id) => id === "contact-1",
    contactRepository: {
      async setArchiveStatusById({ contactId, archived }) {
        assert.equal(contactId, "contact-1");
        assert.equal(archived, true);
        return {
          _id: "contact-1",
          user: "user-1",
          userEmail: "ada@example.com",
          isArchived: true,
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
    archived: true,
    adminId: "admin-1",
  });

  assert.equal(result.success, true);
  assert.equal(result.message, "Contact archived successfully");
  assert.equal(result.data.isArchived, true);
  assert.equal(result.data.user.displayName, "Ada Lovelace");
  assert.deepEqual(notes, [
    {
      contactId: "contact-1",
      adminId: "admin-1",
      note: "Contact archived",
    },
  ]);
});

test("ToggleContactArchiveUseCase unarchives a contact and preserves unknown user fallback", async () => {
  const notes = [];

  const useCase = new ToggleContactArchiveUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async setArchiveStatusById() {
        return {
          _id: "contact-2",
          user: "missing-user",
          userEmail: "missing@example.com",
          isArchived: false,
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
    archived: false,
    adminId: "admin-2",
  });

  assert.equal(result.message, "Contact unarchived successfully");
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
      note: "Contact unarchived",
    },
  ]);
});

test("ToggleContactArchiveUseCase rejects invalid contact IDs before mutation", async () => {
  const useCase = new ToggleContactArchiveUseCase({
    isValidContactId: () => false,
    contactRepository: {
      async setArchiveStatusById() {
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
    () => useCase.execute({ id: "bad-id", archived: true }),
    ContactInvalidIdError,
  );
});

test("ToggleContactArchiveUseCase rejects non-boolean archive payloads", async () => {
  const useCase = new ToggleContactArchiveUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async setArchiveStatusById() {
        throw new Error("Should not update invalid archive values.");
      },
      async addAdminNote() {
        throw new Error("Should not write notes for invalid archive values.");
      },
    },
    contactUserRepository: {
      async findContactUsersByIds() {
        throw new Error("Should not query users for invalid archive values.");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "contact-1", archived: "true" }),
    ContactInvalidArchiveValueError,
  );
});

test("ToggleContactArchiveUseCase rejects missing contacts", async () => {
  const useCase = new ToggleContactArchiveUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async setArchiveStatusById() {
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
    () => useCase.execute({ id: "contact-404", archived: true }),
    ContactNotFoundError,
  );
});
