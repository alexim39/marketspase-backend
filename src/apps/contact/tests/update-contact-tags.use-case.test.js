import test from "node:test";
import assert from "node:assert/strict";

import { UpdateContactTagsUseCase } from "../application/use-cases/update-contact-tags.use-case.js";
import {
  ContactInvalidIdError,
  ContactInvalidTagsValueError,
  ContactNotFoundError,
} from "../domain/errors/contact.errors.js";

test("UpdateContactTagsUseCase cleans tags, writes them, and records the legacy admin note", async () => {
  const calls = [];

  const useCase = new UpdateContactTagsUseCase({
    isValidContactId: (id) => id === "contact-1",
    contactRepository: {
      async setTagsById({ contactId, tags }) {
        calls.push(["setTagsById", contactId, tags]);
        return {
          _id: contactId,
          user: "user-1",
          userEmail: "ada@example.com",
          tags,
        };
      },
      async addAdminNote(contact, adminId, note) {
        calls.push(["addAdminNote", contact._id, adminId, note]);
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
    tags: ["  vip  ", "", " urgent ", "   "],
  });

  assert.equal(result.success, true);
  assert.equal(result.message, "Tags updated successfully");
  assert.deepEqual(result.data.tags, ["vip", "urgent"]);
  assert.deepEqual(result.data.user, {
    _id: "user-1",
    username: "adalovelace",
    displayName: "Ada Lovelace",
    avatar: "/ada.png",
    email: "ada@example.com",
  });
  assert.deepEqual(calls, [
    ["setTagsById", "contact-1", ["vip", "urgent"]],
    ["addAdminNote", "contact-1", "admin-1", "Tags updated: vip, urgent"],
    ["findContactUsersByIds", ["user-1"]],
  ]);
});

test("UpdateContactTagsUseCase records the legacy No tags note when all tags are blank", async () => {
  const notes = [];

  const useCase = new UpdateContactTagsUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async setTagsById({ tags }) {
        assert.deepEqual(tags, []);
        return {
          _id: "contact-2",
          user: "missing-user",
          userEmail: "missing@example.com",
          tags,
        };
      },
      async addAdminNote(contact, adminId, note) {
        notes.push({ contactId: contact._id, adminId, note });
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
    tags: ["", "   "],
  });

  assert.deepEqual(notes, [
    {
      contactId: "contact-2",
      adminId: "admin-2",
      note: "Tags updated: No tags",
    },
  ]);
  assert.deepEqual(result.data.user, {
    _id: "missing-user",
    username: "Unknown",
    displayName: "Unknown User",
    avatar: "/img/avatar.png",
    email: "missing@example.com",
  });
});

test("UpdateContactTagsUseCase rejects invalid contact IDs before repository access", async () => {
  const useCase = new UpdateContactTagsUseCase({
    isValidContactId: () => false,
    contactRepository: {
      async setTagsById() {
        throw new Error("Should not update invalid contact IDs.");
      },
    },
    contactUserRepository: {},
  });

  await assert.rejects(
    () => useCase.execute({ id: "bad-id", adminId: "admin-1", tags: [] }),
    ContactInvalidIdError,
  );
});

test("UpdateContactTagsUseCase rejects non-array tags before repository access", async () => {
  const useCase = new UpdateContactTagsUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async setTagsById() {
        throw new Error("Should not update non-array tags.");
      },
    },
    contactUserRepository: {},
  });

  await assert.rejects(
    () => useCase.execute({ id: "contact-1", adminId: "admin-1", tags: "urgent" }),
    ContactInvalidTagsValueError,
  );
});

test("UpdateContactTagsUseCase rejects missing contacts without writing notes", async () => {
  const useCase = new UpdateContactTagsUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async setTagsById() {
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
    () => useCase.execute({ id: "contact-404", adminId: "admin-1", tags: [] }),
    ContactNotFoundError,
  );
});
