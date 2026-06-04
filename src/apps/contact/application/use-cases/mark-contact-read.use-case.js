import {
  ContactInvalidIdError,
  ContactNotFoundError,
} from "../../domain/errors/contact.errors.js";
import { MarkContactReadDto } from "../dto/mark-contact-read.dto.js";

export class MarkContactReadUseCase {
  constructor({ contactRepository, contactUserRepository, isValidContactId }) {
    this.contactRepository = contactRepository;
    this.contactUserRepository = contactUserRepository;
    this.isValidContactId = isValidContactId;
  }

  async execute(input) {
    const dto = input instanceof MarkContactReadDto
      ? input
      : new MarkContactReadDto(input);

    if (!this.isValidContactId(dto.id)) {
      throw new ContactInvalidIdError();
    }

    const contact = await this.contactRepository.markAsReadById(dto.id);
    if (!contact) {
      throw new ContactNotFoundError();
    }

    const [populatedContact] = await this.populateUserData([contact]);

    return {
      success: true,
      data: populatedContact,
      message: "Contact marked as read",
    };
  }

  async populateUserData(contacts) {
    if (!contacts || contacts.length === 0) return contacts;

    const userIds = [
      ...new Set(contacts.map((contact) => contact.user.toString())),
    ];

    const users = await this.contactUserRepository.findContactUsersByIds(userIds);
    const userMap = users.reduce((map, user) => {
      map[user._id.toString()] = user;
      return map;
    }, {});

    return contacts.map((contact) => ({
      ...(contact.toObject ? contact.toObject() : contact),
      user: userMap[contact.user.toString()] || {
        _id: contact.user,
        username: "Unknown",
        displayName: "Unknown User",
        avatar: "/img/avatar.png",
        email: contact.userEmail,
      },
    }));
  }
}
