import test from "node:test";
import assert from "node:assert/strict";

import { AddContactAdminNoteUseCase } from "../application/use-cases/add-contact-admin-note.use-case.js";
import {
  ContactAdminNoteRequiredError,
  ContactInvalidIdError,
  ContactNotFoundError,
} from "../domain/errors/contact.errors.js";

test("AddContactAdminNoteUseCase adds a trimmed admin note and returns populated contact data", async () => {
  const calls = [];
  const updatedContact = {
    _id: "contact-1",
    user: "user-1",
    userEmail: "ada@example.com",
    adminNotes: [
      {
        admin: "admin-1",
        note: "Reviewed the issue",
      },
    ],
  };

  const useCase = new AddContactAdminNoteUseCase({
    isValidContactId: (id) => id === "contact-1",
    contactRepository: {
      async findById(contactId) {
        calls.push(["findById", contactId]);
        return {
          _id: contactId,
          user: "user-1",
          userEmail: "ada@example.com",
        };
      },
      async addAdminNote(contact, adminId, note) {
        calls.push(["addAdminNote", contact._id, adminId, note]);
      },
      async findByIdWithWorkflowDetails(contactId) {
        calls.push(["findByIdWithWorkflowDetails", contactId]);
        return updatedContact;
      },
    },
    contactUserRepository: {
      async findContactUsersByIds(userIds) {
        calls.push(["findContactUsersByIds", userIds]);
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
    adminId: "admin-1",
    note: "  Reviewed the issue  ",
  });

  assert.equal(result.success, true);
  assert.equal(result.message, "Note added successfully");
  assert.deepEqual(result.data.user, {
    _id: "user-1",
    username: "adalovelace",
    displayName: "Ada Lovelace",
    avatar: "/ada.png",
    email: "ada@example.com",
  });
  assert.deepEqual(calls, [
    ["findById", "contact-1"],
    ["addAdminNote", "contact-1", "admin-1", "Reviewed the issue"],
    ["findByIdWithWorkflowDetails", "contact-1"],
    ["findContactUsersByIds", ["user-1"]],
  ]);
});

test("AddContactAdminNoteUseCase keeps the legacy unknown user fallback", async () => {
  const useCase = new AddContactAdminNoteUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async findById() {
        return {
          _id: "contact-2",
          user: "missing-user",
          userEmail: "missing@example.com",
        };
      },
      async addAdminNote() {},
      async findByIdWithWorkflowDetails() {
        return {
          _id: "contact-2",
          user: "missing-user",
          userEmail: "missing@example.com",
        };
      },
    },
    contactUserRepository: {
      async findContactUsersByIds(userIds) {
        assert.deepEqual(userIds, ["missing-user"]);
        return [];
      },
    },
  });

  const result = await useCase.execute({
    id: "contact-2",
    adminId: "admin-2",
    note: "Follow up tomorrow",
  });

  assert.deepEqual(result.data.user, {
    _id: "missing-user",
    username: "Unknown",
    displayName: "Unknown User",
    avatar: "/img/avatar.png",
    email: "missing@example.com",
  });
});

test("AddContactAdminNoteUseCase rejects invalid contact IDs before repository access", async () => {
  const useCase = new AddContactAdminNoteUseCase({
    isValidContactId: () => false,
    contactRepository: {
      async findById() {
        throw new Error("Should not query invalid contact IDs.");
      },
    },
    contactUserRepository: {},
  });

  await assert.rejects(
    () => useCase.execute({ id: "bad-id", adminId: "admin-1", note: "Note" }),
    ContactInvalidIdError,
  );
});

test("AddContactAdminNoteUseCase rejects empty notes before repository access", async () => {
  const useCase = new AddContactAdminNoteUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async findById() {
        throw new Error("Should not query when note is empty.");
      },
    },
    contactUserRepository: {},
  });

  await assert.rejects(
    () => useCase.execute({ id: "contact-1", adminId: "admin-1", note: "   " }),
    ContactAdminNoteRequiredError,
  );
});

test("AddContactAdminNoteUseCase rejects missing contacts without writing notes", async () => {
  const useCase = new AddContactAdminNoteUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async findById() {
        return null;
      },
      async addAdminNote() {
        throw new Error("Should not write notes for missing contacts.");
      },
      async findByIdWithWorkflowDetails() {
        throw new Error("Should not reload missing contacts.");
      },
    },
    contactUserRepository: {
      async findContactUsersByIds() {
        throw new Error("Should not query users for missing contacts.");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "contact-404", adminId: "admin-1", note: "Note" }),
    ContactNotFoundError,
  );
});
