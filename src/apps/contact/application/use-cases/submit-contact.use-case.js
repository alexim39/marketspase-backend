import {
  ContactAuthenticationRequiredError,
  ContactUserNotFoundError,
} from "../../domain/errors/contact.errors.js";
import { ContactRequestId } from "../../domain/value-objects/contact-request-id.vo.js";
import { ContactSubmittedEvent } from "../../domain/events/contact-submitted.event.js";
import { ContactMapper } from "../mappers/contact.mapper.js";
import { SubmitContactDto } from "../dto/submit-contact.dto.js";

export class SubmitContactUseCase {
  constructor({ contactRepository, contactUserRepository, requestIdFactory = ContactRequestId.generateNumeric }) {
    this.contactRepository = contactRepository;
    this.contactUserRepository = contactUserRepository;
    this.requestIdFactory = requestIdFactory;
  }

  async execute(input) {
    const dto = input instanceof SubmitContactDto
      ? input
      : new SubmitContactDto(input);

    if (!dto.userId) {
      throw new ContactAuthenticationRequiredError();
    }

    const user = await this.contactUserRepository.findById(dto.userId);
    if (!user) {
      throw new ContactUserNotFoundError();
    }

    await this.contactUserRepository.touchLastSeen(user._id);

    const requestId = this.requestIdFactory();
    const contact = ContactMapper.toSubmissionEntity({ dto, user, requestId });
    const savedContact = await this.contactRepository.create(contact.toPersistence());

    return {
      contact: savedContact,
      events: [
        new ContactSubmittedEvent({
          contactId: savedContact?._id,
          userId: user._id,
          requestId: contact.requestId.toString(),
        }),
      ],
    };
  }
}
