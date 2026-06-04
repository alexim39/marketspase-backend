import { CONTACT_PRIORITY_ARRAY } from "../../domain/contact.constants.js";
import {
  ContactInvalidIdError,
  ContactInvalidPriorityValueError,
  ContactNotFoundError,
} from "../../domain/errors/contact.errors.js";
import { UpdateContactPriorityDto } from "../dto/update-contact-priority.dto.js";

export class UpdateContactPriorityUseCase {
  constructor({ contactRepository, contactUserRepository, isValidContactId }) {
    this.contactRepository = contactRepository;
    this.contactUserRepository = contactUserRepository;
    this.isValidContactId = isValidContactId;
  }

  async execute(input) {
    const dto = input instanceof UpdateContactPriorityDto
      ? input
      : new UpdateContactPriorityDto(input);

    if (!this.isValidContactId(dto.id)) {
      throw new ContactInvalidIdError();
    }

    if (!CONTACT_PRIORITY_ARRAY.includes(dto.priority)) {
      throw new ContactInvalidPriorityValueError();
    }

    const contact = await this.contactRepository.setPriorityById({
      contactId: dto.id,
      priority: dto.priority,
    });

    if (!contact) {
      throw new ContactNotFoundError();
    }

    await this.contactRepository.addAdminNote(
      contact,
      dto.adminId,
      `Priority changed to ${dto.priority}`,
    );

    const [populatedContact] = await this.populateUserData([contact]);

    return {
      success: true,
      data: populatedContact,
      message: `Contact priority updated to ${dto.priority}`,
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
