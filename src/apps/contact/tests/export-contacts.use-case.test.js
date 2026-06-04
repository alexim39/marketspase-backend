import test from "node:test";
import assert from "node:assert/strict";

import { ExportContactsUseCase } from "../application/use-cases/export-contacts.use-case.js";

const fixedNow = () => new Date("2026-05-20T15:00:00.000Z");

test("ExportContactsUseCase exports CSV with legacy headers, escaping, and filename", async () => {
  let filterSnapshot = null;
  const useCase = new ExportContactsUseCase({
    now: fixedNow,
    contactRepository: {
      async findExportContacts({ filter }) {
        filterSnapshot = filter;
        return [
          {
            requestID: "REQ-1",
            user: { displayName: "Ada Lovelace" },
            userEmail: "ada@example.com",
            subject: 'Need "help"',
            message: "Line one\nLine two",
            status: "open",
            priority: "high",
            category: "general",
            reason: "technical",
            createdAt: new Date("2026-05-19T10:15:00.000Z"),
            resolvedAt: null,
            assignedTo: { displayName: "Support Lead" },
            tags: ["vip", "urgent"],
          },
        ];
      },
    },
  });

  const result = await useCase.execute({
    format: "csv",
    status: "open",
    priority: "all",
    category: "general",
    reason: "technical",
    assignedTo: "unassigned",
    isArchived: "false",
  });

  assert.deepEqual(filterSnapshot, {
    status: "open",
    category: "general",
    reason: "technical",
    assignedTo: null,
    isArchived: false,
  });
  assert.equal(result.contentType, "text/csv");
  assert.equal(result.fileName, "contacts_export_2026-05-20.csv");
  assert.equal(
    result.body,
    [
      "Request ID,User,Email,Subject,Message,Status,Priority,Category,Reason,Created At,Resolved At,Assigned To,Tags",
      'REQ-1,Ada Lovelace,ada@example.com,"Need ""help""","Line one Line two",open,high,general,technical,2026-05-19T10:15:00.000Z,,Support Lead,vip, urgent',
    ].join("\n"),
  );
});

test("ExportContactsUseCase falls back to Unknown and blank assigned user values like legacy CSV", async () => {
  const useCase = new ExportContactsUseCase({
    now: fixedNow,
    contactRepository: {
      async findExportContacts() {
        return [
          {
            requestID: "REQ-2",
            user: null,
            userEmail: "unknown@example.com",
            subject: "Subject",
            message: "Message",
            status: "closed",
            priority: "low",
            category: "support",
            reason: "general",
            createdAt: new Date("2026-05-18T09:00:00.000Z"),
            resolvedAt: new Date("2026-05-19T09:00:00.000Z"),
            assignedTo: null,
            tags: [],
          },
        ];
      },
    },
  });

  const result = await useCase.execute({ format: "xml" });

  assert.equal(result.contentType, "text/csv");
  assert.equal(
    result.body.split("\n")[1],
    'REQ-2,Unknown,unknown@example.com,"Subject","Message",closed,low,support,general,2026-05-18T09:00:00.000Z,2026-05-19T09:00:00.000Z,,',
  );
});

test("ExportContactsUseCase exports JSON with legacy pretty formatting", async () => {
  const contacts = [
    {
      requestID: "REQ-3",
      status: "spam",
    },
  ];
  const useCase = new ExportContactsUseCase({
    now: fixedNow,
    contactRepository: {
      async findExportContacts({ filter }) {
        assert.deepEqual(filter, { assignedTo: "admin-1" });
        return contacts;
      },
    },
  });

  const result = await useCase.execute({
    format: "json",
    status: "all",
    assignedTo: "admin-1",
  });

  assert.equal(result.contentType, "application/json");
  assert.equal(result.fileName, "contacts_export_2026-05-20.json");
  assert.equal(result.body, JSON.stringify(contacts, null, 2));
});

test("ExportContactsUseCase builds legacy filter values", () => {
  const useCase = new ExportContactsUseCase({
    contactRepository: {},
    now: fixedNow,
  });

  assert.deepEqual(
    useCase.buildFilter({
      status: "all",
      priority: "urgent",
      category: "billing",
      reason: "all",
      assignedTo: "all",
      isArchived: "true",
    }),
    {
      priority: "urgent",
      category: "billing",
      isArchived: true,
    },
  );
});
