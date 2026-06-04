export class SubmitContactDto {
  constructor({ userId, reason, subject, message, userEmail }) {
    this.userId = userId;
    this.reason = reason;
    this.subject = subject;
    this.message = message;
    this.userEmail = userEmail;
  }

  static fromRequest({ userId, body }) {
    return new SubmitContactDto({
      userId,
      reason: body?.reason,
      subject: body?.subject,
      message: body?.message,
      userEmail: body?.userEmail,
    });
  }
}
