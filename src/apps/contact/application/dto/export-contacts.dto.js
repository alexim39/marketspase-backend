export class ExportContactsDto {
  constructor(query = {}) {
    const { format = "csv", ...filters } = query;

    this.format = format;
    this.status = filters.status;
    this.priority = filters.priority;
    this.category = filters.category;
    this.reason = filters.reason;
    this.assignedTo = filters.assignedTo;
    this.isArchived = filters.isArchived;
  }

  static fromRequest({ query }) {
    return new ExportContactsDto(query);
  }
}
