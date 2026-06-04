import { ContactEmail } from "../value-objects/contact-email.vo.js";
import { ContactReason } from "../value-objects/contact-reason.vo.js";
import { ContactRequestId } from "../value-objects/contact-request-id.vo.js";

export class Contact {
  constructor({ userId, reason, subject, message, requestId, userEmail }) {
    this.userId = userId;
    this.reason = reason;
    this.subject = subject;
    this.message = message;
    this.requestId = requestId;
    this.userEmail = userEmail;
  }

  static createSubmission({ userId, reason, subject, message, requestId, userEmail }) {
    return new Contact({
      userId,
      reason: new ContactReason(reason),
      subject,
      message,
      requestId: requestId instanceof ContactRequestId
        ? requestId
        : new ContactRequestId(String(requestId)),
      userEmail: new ContactEmail(userEmail),
    });
  }

  toPersistence() {
    return {
      user: this.userId,
      reason: this.reason.toString(),
      subject: this.subject,
      message: this.message,
      requestID: this.requestId.toString(),
      userEmail: this.userEmail.toString(),
    };
  }
}
