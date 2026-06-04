import test from "node:test";
import assert from "node:assert/strict";

import { DeleteContactUseCase } from "../application/use-cases/delete-contact.use-case.js";
import {
  ContactInvalidIdError,
  ContactNotFoundError,
} from "../domain/errors/contact.errors.js";

test("DeleteContactUseCase deletes a contact and returns the legacy response shape", async () => {
  const calls = [];
  const useCase = new DeleteContactUseCase({
    isValidContactId: (id) => id === "contact-1",
    contactRepository: {
      async deleteById(contactId) {
        calls.push(["deleteById", contactId]);
        return {
          _id: contactId,
        };
      },
    },
  });

  const result = await useCase.execute({ id: "contact-1" });

  assert.deepEqual(calls, [["deleteById", "contact-1"]]);
  assert.deepEqual(result, {
    success: true,
    message: "Contact message deleted successfully",
  });
});

test("DeleteContactUseCase rejects invalid contact IDs before repository access", async () => {
  const useCase = new DeleteContactUseCase({
    isValidContactId: () => false,
    contactRepository: {
      async deleteById() {
        throw new Error("Should not delete invalid contact IDs.");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "bad-id" }),
    ContactInvalidIdError,
  );
});

test("DeleteContactUseCase rejects missing contacts", async () => {
  const useCase = new DeleteContactUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async deleteById(contactId) {
        assert.equal(contactId, "contact-404");
        return null;
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ id: "contact-404" }),
    ContactNotFoundError,
  );
});
