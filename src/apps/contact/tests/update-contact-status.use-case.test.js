import test from "node:test";
import assert from "node:assert/strict";

import { UpdateContactStatusUseCase } from "../application/use-cases/update-contact-status.use-case.js";
import {
  ContactInvalidIdError,
  ContactInvalidStatusValueError,
  ContactNotFoundError,
} from "../domain/errors/contact.errors.js";

test("UpdateContactStatusUseCase resolves with notes and records the legacy admin note", async () => {
  const notes = [];
  let updateDataSnapshot = null;

  const useCase = new UpdateContactStatusUseCase({
    isValidContactId: (id) => id === "contact-1",
    contactRepository: {
      async findById(contactId) {
        assert.equal(contactId, "contact-1");
        return { _id: "contact-1" };
      },
      async setStatusById({ contactId, updateData }) {
        assert.equal(contactId, "contact-1");
        updateDataSnapshot = updateData;
        return {
          _id: "contact-1",
          user: "user-1",
          userEmail: "ada@example.com",
          ...updateData,
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
    status: "resolved",
    notes: "Issue fixed",
    adminId: "admin-1",
  });

  assert.equal(result.success, true);
  assert.equal(result.message, "Contact status updated to resolved");
  assert.equal(result.data.status, "resolved");
  assert.equal(result.data.resolutionNotes, "Issue fixed");
  assert.ok(updateDataSnapshot.resolvedAt instanceof Date);
  assert.deepEqual(notes, [
    {
      contactId: "contact-1",
      adminId: "admin-1",
      note: "Status changed to resolved: Issue fixed",
    },
  ]);
});

test("UpdateContactStatusUseCase reopens without notes and clears resolution notes", async () => {
  let updateDataSnapshot = null;

  const useCase = new UpdateContactStatusUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async findById() {
        return { _id: "contact-2" };
      },
      async setStatusById({ updateData }) {
        updateDataSnapshot = updateData;
        return {
          _id: "contact-2",
          user: "missing-user",
          userEmail: "missing@example.com",
          ...updateData,
        };
      },
      async addAdminNote() {
        throw new Error("Should not add status notes when notes are missing.");
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
    status: "open",
    adminId: "admin-2",
  });

  assert.deepEqual(updateDataSnapshot, {
    status: "open",
    resolvedAt: null,
    resolutionNotes: "",
  });
  assert.deepEqual(result.data.user, {
    _id: "missing-user",
    username: "Unknown",
    displayName: "Unknown User",
    avatar: "/img/avatar.png",
    email: "missing@example.com",
  });
});

test("UpdateContactStatusUseCase keeps closed without notes behavior legacy-compatible", () => {
  const useCase = new UpdateContactStatusUseCase({
    contactRepository: {},
    contactUserRepository: {},
    isValidContactId: () => true,
  });

  assert.deepEqual(useCase.buildUpdateData({ status: "closed" }), {
    status: "closed",
  });
});

test("UpdateContactStatusUseCase rejects invalid contact IDs before repository access", async () => {
  const useCase = new UpdateContactStatusUseCase({
    isValidContactId: () => false,
    contactRepository: {
      async findById() {
        throw new Error("Should not query invalid IDs.");
      },
    },
    contactUserRepository: {},
  });

  await assert.rejects(
    () => useCase.execute({ id: "bad-id", status: "open" }),
    ContactInvalidIdError,
  );
});

test("UpdateContactStatusUseCase rejects invalid status values", async () => {
  const useCase = new UpdateContactStatusUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async findById() {
        throw new Error("Should not query invalid statuses.");
      },
    },
    contactUserRepository: {},
  });

  await assert.rejects(
    () => useCase.execute({ id: "contact-1", status: "waiting" }),
    ContactInvalidStatusValueError,
  );
});

test("UpdateContactStatusUseCase rejects missing contacts", async () => {
  const useCase = new UpdateContactStatusUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async findById() {
        return null;
      },
      async setStatusById() {
        throw new Error("Should not update missing contacts.");
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
    () => useCase.execute({ id: "contact-404", status: "open" }),
    ContactNotFoundError,
  );
});
