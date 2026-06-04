import test from "node:test";
import assert from "node:assert/strict";

import { MarkContactReadUseCase } from "../application/use-cases/mark-contact-read.use-case.js";
import {
  ContactInvalidIdError,
  ContactNotFoundError,
} from "../domain/errors/contact.errors.js";

test("MarkContactReadUseCase marks a contact read and returns the legacy response shape", async () => {
  const useCase = new MarkContactReadUseCase({
    isValidContactId: (id) => id === "contact-1",
    contactRepository: {
      async markAsReadById(contactId) {
        assert.equal(contactId, "contact-1");
        return {
          _id: "contact-1",
          user: "user-1",
          userEmail: "ada@example.com",
          isRead: true,
        };
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

  const result = await useCase.execute({ id: "contact-1" });

  assert.equal(result.success, true);
  assert.equal(result.message, "Contact marked as read");
  assert.equal(result.data.isRead, true);
  assert.equal(result.data.user.displayName, "Ada Lovelace");
});

test("MarkContactReadUseCase preserves unknown user fallback", async () => {
  const useCase = new MarkContactReadUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async markAsReadById() {
        return {
          _id: "contact-2",
          user: "missing-user",
          userEmail: "missing@example.com",
          isRead: true,
        };
      },
    },
    contactUserRepository: {
      async findContactUsersByIds() {
        return [];
      },
    },
  });

  const result = await useCase.execute({ id: "contact-2" });

  assert.deepEqual(result.data.user, {
    _id: "missing-user",
    username: "Unknown",
    displayName: "Unknown User",
    avatar: "/img/avatar.png",
    email: "missing@example.com",
  });
});

test("MarkContactReadUseCase rejects invalid contact IDs before mutation", async () => {
  const useCase = new MarkContactReadUseCase({
    isValidContactId: () => false,
    contactRepository: {
      async markAsReadById() {
        throw new Error("Should not update invalid IDs.");
      },
    },
    contactUserRepository: {
      async findContactUsersByIds() {
        throw new Error("Should not query users for invalid IDs.");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "bad-id" }),
    ContactInvalidIdError,
  );
});

test("MarkContactReadUseCase rejects missing contacts", async () => {
  const useCase = new MarkContactReadUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async markAsReadById() {
        return null;
      },
    },
    contactUserRepository: {
      async findContactUsersByIds() {
        throw new Error("Should not query users for missing contacts.");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "contact-404" }),
    ContactNotFoundError,
  );
});
