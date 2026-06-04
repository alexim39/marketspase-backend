import test from "node:test";
import assert from "node:assert/strict";

import { GetContactMessageUseCase } from "../application/use-cases/get-contact-message.use-case.js";
import {
  ContactInvalidIdError,
  ContactNotFoundError,
} from "../domain/errors/contact.errors.js";

test("GetContactMessageUseCase returns the same detail response shape with populated user", async () => {
  const useCase = new GetContactMessageUseCase({
    isValidContactId: (id) => id === "contact-1",
    contactRepository: {
      async findByIdWithAdminDetails(contactId) {
        assert.equal(contactId, "contact-1");
        return {
          _id: "contact-1",
          user: "user-1",
          userEmail: "ada@example.com",
          subject: "Need help",
          message: "Please help me with my store.",
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
  assert.equal(result.data._id, "contact-1");
  assert.equal(result.data.subject, "Need help");
  assert.equal(result.data.user.displayName, "Ada Lovelace");
});

test("GetContactMessageUseCase preserves unknown user fallback", async () => {
  const useCase = new GetContactMessageUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async findByIdWithAdminDetails() {
        return {
          _id: "contact-2",
          user: "missing-user",
          userEmail: "missing@example.com",
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

test("GetContactMessageUseCase rejects invalid contact IDs before repository access", async () => {
  const useCase = new GetContactMessageUseCase({
    isValidContactId: () => false,
    contactRepository: {
      async findByIdWithAdminDetails() {
        throw new Error("Should not query contact repository for invalid IDs.");
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

test("GetContactMessageUseCase rejects missing contact records", async () => {
  const useCase = new GetContactMessageUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async findByIdWithAdminDetails() {
        return null;
      },
    },
    contactUserRepository: {
      async findContactUsersByIds() {
        throw new Error("Should not query users for missing contact records.");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "contact-404" }),
    ContactNotFoundError,
  );
});
