import { Contact } from "../../domain/entities/contact.entity.js";

export class ContactMapper {
  static toSubmissionEntity({ dto, user, requestId }) {
    return Contact.createSubmission({
      userId: user._id,
      reason: dto.reason,
      subject: dto.subject,
      message: dto.message,
      requestId,
      userEmail: user.email || dto.userEmail,
    });
  }
}
