import test from "node:test";
import assert from "node:assert/strict";

import { SetContactFollowUpUseCase } from "../application/use-cases/set-contact-follow-up.use-case.js";
import {
  ContactInvalidIdError,
  ContactNotFoundError,
} from "../domain/errors/contact.errors.js";

test("SetContactFollowUpUseCase sets follow-up date and records the admin note", async () => {
  const notes = [];
  let persistedDate = null;

  const useCase = new SetContactFollowUpUseCase({
    isValidContactId: (id) => id === "contact-1",
    contactRepository: {
      async setFollowUpDateById({ contactId, followUpDate }) {
        assert.equal(contactId, "contact-1");
        persistedDate = followUpDate;
        return {
          _id: "contact-1",
          user: "user-1",
          userEmail: "ada@example.com",
          followUpDate,
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
    date: "2026-05-20T10:15:00.000Z",
    adminId: "admin-1",
  });

  assert.equal(result.success, true);
  assert.equal(result.message, `Follow-up date set to ${persistedDate.toLocaleDateString()}`);
  assert.equal(result.data.followUpDate, persistedDate);
  assert.equal(result.data.user.displayName, "Ada Lovelace");
  assert.deepEqual(notes, [
    {
      contactId: "contact-1",
      adminId: "admin-1",
      note: `Follow-up date set to ${persistedDate.toLocaleDateString()}`,
    },
  ]);
});

test("SetContactFollowUpUseCase clears follow-up date and preserves unknown user fallback", async () => {
  const notes = [];

  const useCase = new SetContactFollowUpUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async setFollowUpDateById({ followUpDate }) {
        assert.equal(followUpDate, null);
        return {
          _id: "contact-2",
          user: "missing-user",
          userEmail: "missing@example.com",
          followUpDate,
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
    date: "",
    adminId: "admin-2",
  });

  assert.equal(result.message, "Follow-up date cleared");
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
      note: "Follow-up date cleared",
    },
  ]);
});

test("SetContactFollowUpUseCase rejects invalid contact IDs before mutation", async () => {
  const useCase = new SetContactFollowUpUseCase({
    isValidContactId: () => false,
    contactRepository: {
      async setFollowUpDateById() {
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
    () => useCase.execute({ id: "bad-id", date: "2026-05-20" }),
    ContactInvalidIdError,
  );
});

test("SetContactFollowUpUseCase rejects missing contacts", async () => {
  const useCase = new SetContactFollowUpUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async setFollowUpDateById() {
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
    () => useCase.execute({ id: "contact-404", date: "2026-05-20" }),
    ContactNotFoundError,
  );
});
