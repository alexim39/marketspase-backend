import {
  ContactInvalidArchiveValueError,
  ContactInvalidIdError,
  ContactNotFoundError,
} from "../../domain/errors/contact.errors.js";
import { ToggleContactArchiveDto } from "../dto/toggle-contact-archive.dto.js";

export class ToggleContactArchiveUseCase {
  constructor({ contactRepository, contactUserRepository, isValidContactId }) {
    this.contactRepository = contactRepository;
    this.contactUserRepository = contactUserRepository;
    this.isValidContactId = isValidContactId;
  }

  async execute(input) {
    const dto = input instanceof ToggleContactArchiveDto
      ? input
      : new ToggleContactArchiveDto(input);

    if (!this.isValidContactId(dto.id)) {
      throw new ContactInvalidIdError();
    }

    if (typeof dto.archived !== "boolean") {
      throw new ContactInvalidArchiveValueError();
    }

    const contact = await this.contactRepository.setArchiveStatusById({
      contactId: dto.id,
      archived: dto.archived,
    });

    if (!contact) {
      throw new ContactNotFoundError();
    }

    const action = dto.archived ? "archived" : "unarchived";
    await this.contactRepository.addAdminNote(
      contact,
      dto.adminId,
      `Contact ${action}`,
    );

    const [populatedContact] = await this.populateUserData([contact]);

    return {
      success: true,
      data: populatedContact,
      message: `Contact ${action} successfully`,
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
