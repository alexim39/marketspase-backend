import { ExportContactsDto } from "../dto/export-contacts.dto.js";

const CSV_HEADERS = [
  "Request ID",
  "User",
  "Email",
  "Subject",
  "Message",
  "Status",
  "Priority",
  "Category",
  "Reason",
  "Created At",
  "Resolved At",
  "Assigned To",
  "Tags",
];

export class ExportContactsUseCase {
  constructor({ contactRepository, now = () => new Date() }) {
    this.contactRepository = contactRepository;
    this.now = now;
  }

  async execute(input) {
    const dto = input instanceof ExportContactsDto
      ? input
      : new ExportContactsDto(input);

    const contacts = await this.contactRepository.findExportContacts({
      filter: this.buildFilter(dto),
    });

    if (dto.format === "json") {
      return {
        body: JSON.stringify(contacts, null, 2),
        contentType: "application/json",
        fileName: this.buildFileName("json"),
      };
    }

    return {
      body: this.toCsv(contacts),
      contentType: "text/csv",
      fileName: this.buildFileName("csv"),
    };
  }

  buildFilter(dto) {
    const filter = {};

    if (dto.status && dto.status !== "all") {
      filter.status = dto.status;
    }

    if (dto.priority && dto.priority !== "all") {
      filter.priority = dto.priority;
    }

    if (dto.category && dto.category !== "all") {
      filter.category = dto.category;
    }

    if (dto.reason && dto.reason !== "all") {
      filter.reason = dto.reason;
    }

    if (dto.assignedTo && dto.assignedTo !== "all") {
      filter.assignedTo = dto.assignedTo === "unassigned" ? null : dto.assignedTo;
    }

    if (dto.isArchived !== undefined) {
      filter.isArchived = dto.isArchived === "true";
    }

    return filter;
  }

  toCsv(contacts) {
    const rows = contacts.map((contact) => [
      contact.requestID,
      contact.user?.displayName || "Unknown",
      contact.userEmail,
      `"${contact.subject.replace(/"/g, '""')}"`,
      `"${contact.message.replace(/"/g, '""').replace(/\n/g, " ")}"`,
      contact.status,
      contact.priority,
      contact.category,
      contact.reason,
      contact.createdAt.toISOString(),
      contact.resolvedAt ? contact.resolvedAt.toISOString() : "",
      contact.assignedTo?.displayName || "",
      contact.tags.join(", "),
    ]);

    return [
      CSV_HEADERS.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");
  }

  buildFileName(extension) {
    return `contacts_export_${this.now().toISOString().split("T")[0]}.${extension}`;
  }
}
