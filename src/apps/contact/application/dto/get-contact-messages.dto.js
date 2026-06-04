export class GetContactMessagesDto {
  constructor(query = {}) {
    this.page = query.page ?? 1;
    this.limit = query.limit ?? 20;
    this.status = query.status;
    this.priority = query.priority;
    this.category = query.category;
    this.reason = query.reason;
    this.assignedTo = query.assignedTo;
    this.search = query.search;
    this.dateFrom = query.dateFrom;
    this.dateTo = query.dateTo;
    this.isArchived = query.isArchived;
    this.sortBy = query.sortBy ?? "createdAt";
    this.sortOrder = query.sortOrder ?? "desc";
  }

  static fromRequest({ query }) {
    return new GetContactMessagesDto(query);
  }
}
