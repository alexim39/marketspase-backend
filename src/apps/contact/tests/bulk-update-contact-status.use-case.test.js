import test from "node:test";
import assert from "node:assert/strict";

import { BulkUpdateContactStatusUseCase } from "../application/use-cases/bulk-update-contact-status.use-case.js";
import {
  ContactIdsRequiredError,
  ContactInvalidStatusValueError,
  ContactNoValidIdsError,
} from "../domain/errors/contact.errors.js";

test("BulkUpdateContactStatusUseCase filters valid IDs, updates status, and writes legacy admin notes", async () => {
  const calls = [];
  const notes = [];

  const useCase = new BulkUpdateContactStatusUseCase({
    isValidContactId: (id) => id.startsWith("valid-"),
    contactRepository: {
      async bulkSetStatusByIds({ contactIds, updateData }) {
        calls.push(["bulkSetStatusByIds", contactIds, updateData]);
        assert.deepEqual(contactIds, ["valid-1", "valid-2"]);
        assert.equal(updateData.status, "resolved");
        assert.ok(updateData.resolvedAt instanceof Date);
        return { modifiedCount: 2 };
      },
      async findById(contactId) {
        calls.push(["findById", contactId]);
        return contactId === "valid-2" ? null : { _id: contactId };
      },
      async addAdminNote(contact, adminId, note) {
        notes.push({ contactId: contact._id, adminId, note });
      },
    },
  });

  const result = await useCase.execute({
    ids: ["valid-1", "bad-id", "valid-2"],
    status: "resolved",
    adminId: "admin-1",
  });

  assert.deepEqual(result, {
    success: true,
    message: "Updated 2 contacts",
    updatedCount: 2,
  });
  assert.deepEqual(notes, [
    {
      contactId: "valid-1",
      adminId: "admin-1",
      note: "Bulk status update: Changed to resolved",
    },
  ]);
  assert.deepEqual(calls.map(([name]) => name), [
    "bulkSetStatusByIds",
    "findById",
    "findById",
  ]);
});

test("BulkUpdateContactStatusUseCase clears resolvedAt for non-terminal statuses", () => {
  const useCase = new BulkUpdateContactStatusUseCase({
    contactRepository: {},
    isValidContactId: () => true,
  });

  assert.deepEqual(useCase.buildUpdateData("open"), {
    status: "open",
    resolvedAt: null,
  });
});

test("BulkUpdateContactStatusUseCase rejects missing contact IDs before status validation", async () => {
  const useCase = new BulkUpdateContactStatusUseCase({
    isValidContactId: () => true,
    contactRepository: {
      async bulkSetStatusByIds() {
        throw new Error("Should not update missing IDs.");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ ids: [], status: "open" }),
    ContactIdsRequiredError,
  );
});

test("BulkUpdateContactStatusUseCase rejects invalid statuses before filtering IDs", async () => {
  const useCase = new BulkUpdateContactStatusUseCase({
    isValidContactId: () => {
      throw new Error("Should not validate IDs for invalid statuses.");
    },
    contactRepository: {},
  });

  await assert.rejects(
    () => useCase.execute({ ids: ["valid-1"], status: "waiting" }),
    ContactInvalidStatusValueError,
  );
});

test("BulkUpdateContactStatusUseCase rejects when no valid contact IDs remain", async () => {
  const useCase = new BulkUpdateContactStatusUseCase({
    isValidContactId: () => false,
    contactRepository: {
      async bulkSetStatusByIds() {
        throw new Error("Should not update when all IDs are invalid.");
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ ids: ["bad-1", "bad-2"], status: "open" }),
    ContactNoValidIdsError,
  );
});
