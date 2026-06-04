export class ContactSubmittedEvent {
  constructor({ contactId, userId, requestId, occurredAt = new Date() }) {
    this.type = "contact.submitted";
    this.contactId = contactId;
    this.userId = userId;
    this.requestId = requestId;
    this.occurredAt = occurredAt;
  }
}
