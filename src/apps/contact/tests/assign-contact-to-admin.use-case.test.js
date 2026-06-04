import test from "node:test";
import assert from "node:assert/strict";

import { AssignContactToAdminUseCase } from "../application/use-cases/assign-contact-to-admin.use-case.js";
import {
  ContactInvalidAdminIdError,
  ContactInvalidAdminUserError,
  ContactInvalidIdError,
  ContactNotFoundError,
} from "../domain/errors/contact.errors.js";

test("AssignContactToAdminUseCase assigns a valid admin and records the legacy note", async () => {
  const notes = [];

  const useCase = new AssignContactToAdminUseCase({
    isValidContactId: (id) => id === "contact-1",
    isValidAdminId: (id) => id === "admin-user-1",
    contactRepository: {
      async assignToAdminById({ contactId, assigneeId }) {
        assert.equal(contactId, "contact-1");
        assert.equal(assigneeId, "admin-user-1");
        return {
          _id: "contact-1",
          user: "user-1",
          userEmail: "ada@example.com",
          assignedTo: assigneeId,
        };
      },
      async addAdminNote(contact, adminId, note) {
        notes.push({ contactId: contact._id, adminId, note });
      },
    },
    contactUserRepository: {
      async findContactAdminById(adminId) {
        assert.equal(adminId, "admin-user-1");
        return {
          _id: "admin-user-1",
          role: "admin",
          displayName: "Support Lead",
        };
      },
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
    assigneeId: "admin-user-1",
    actorAdminId: "actor-admin-1",
  });

  assert.equal(result.success, true);
  assert.equal(result.message, "Contact assigned successfully");
  assert.equal(result.data.assignedTo, "admin-user-1");
  assert.deepEqual(notes, [
    {
      contactId: "contact-1",
      adminId: "actor-admin-1",
      note: "Assigned to Support Lead",
    },
  ]);
});

test("AssignContactToAdminUseCase unassigns when assignee is empty", async () => {
  const notes = [];

  const useCase = new AssignContactToAdminUseCase({
    isValidContactId: () => true,
    isValidAdminId: () => {
      throw new Error("Should not validate empty assignee IDs.");
    },
    contactRepository: {
      async assignToAdminById({ assigneeId }) {
        assert.equal(assigneeId, null);
        return {
          _id: "contact-2",
          user: "missing-user",
          userEmail: "missing@example.com",
          assignedTo: null,
        };
      },
      async addAdminNote(contact, adminId, note) {
        notes.push({ contactId: contact._id, adminId, note });
      },
    },
    contactUserRepository: {
      async findContactAdminById() {
        throw new Error("Should not query admins for empty assignee IDs.");
      },
      async findContactUsersByIds() {
        return [];
      },
    },
  });

  const result = await useCase.execute({
    id: "contact-2",
    assigneeId: "",
    actorAdminId: "actor-admin-2",
  });

  assert.equal(result.message, "Contact unassigned");
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
      adminId: "actor-admin-2",
      note: "Unassigned from admin",
    },
  ]);
});

test("AssignContactToAdminUseCase allows marketing reps", async () => {
  const useCase = new AssignContactToAdminUseCase({
    isValidContactId: () => true,
    isValidAdminId: () => true,
    contactRepository: {
      async assignToAdminById({ assigneeId }) {
        return {
          _id: "contact-3",
          user: "user-3",
          userEmail: "user3@example.com",
          assignedTo: assigneeId,
        };
      },
      async addAdminNote() {},
    },
    contactUserRepository: {
      async findContactAdminById() {
        return {
          _id: "rep-1",
          role: "marketing_rep",
          displayName: "Marketing Rep",
        };
      },
      async findContactUsersByIds() {
        return [];
      },
    },
  });

  const result = await useCase.execute({
    id: "contact-3",
    assigneeId: "rep-1",
    actorAdminId: "actor-admin-3",
  });

  assert.equal(result.message, "Contact assigned successfully");
});

test("AssignContactToAdminUseCase rejects invalid contact IDs before assignment", async () => {
  const useCase = new AssignContactToAdminUseCase({
    isValidContactId: () => false,
    isValidAdminId: () => true,
    contactRepository: {
      async assignToAdminById() {
        throw new Error("Should not assign invalid contact IDs.");
      },
    },
    contactUserRepository: {},
  });

  await assert.rejects(
    () => useCase.execute({ id: "bad-id", assigneeId: "admin-1" }),
    ContactInvalidIdError,
  );
});

test("AssignContactToAdminUseCase rejects invalid admin IDs", async () => {
  const useCase = new AssignContactToAdminUseCase({
    isValidContactId: () => true,
    isValidAdminId: () => false,
    contactRepository: {
      async assignToAdminById() {
        throw new Error("Should not assign invalid admin IDs.");
      },
    },
    contactUserRepository: {
      async findContactAdminById() {
        throw new Error("Should not query invalid admin IDs.");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "contact-1", assigneeId: "bad-admin" }),
    ContactInvalidAdminIdError,
  );
});

test("AssignContactToAdminUseCase rejects missing or non-assignable admin users", async () => {
  const useCase = new AssignContactToAdminUseCase({
    isValidContactId: () => true,
    isValidAdminId: () => true,
    contactRepository: {
      async assignToAdminById() {
        throw new Error("Should not assign invalid admin users.");
      },
    },
    contactUserRepository: {
      async findContactAdminById() {
        return { _id: "buyer-1", role: "buyer", displayName: "Buyer" };
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "contact-1", assigneeId: "buyer-1" }),
    ContactInvalidAdminUserError,
  );
});

test("AssignContactToAdminUseCase rejects missing contacts", async () => {
  const useCase = new AssignContactToAdminUseCase({
    isValidContactId: () => true,
    isValidAdminId: () => true,
    contactRepository: {
      async assignToAdminById() {
        return null;
      },
      async addAdminNote() {
        throw new Error("Should not write notes for missing contacts.");
      },
    },
    contactUserRepository: {
      async findContactAdminById() {
        return { _id: "admin-1", role: "admin", displayName: "Admin" };
      },
      async findContactUsersByIds() {
        throw new Error("Should not query users for missing contacts.");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "contact-404", assigneeId: "admin-1" }),
    ContactNotFoundError,
  );
});
