import {
  ContactInvalidIdError,
  ContactNotFoundError,
} from "../../domain/errors/contact.errors.js";
import { SetContactFollowUpDto } from "../dto/set-contact-follow-up.dto.js";

export class SetContactFollowUpUseCase {
  constructor({ contactRepository, contactUserRepository, isValidContactId }) {
    this.contactRepository = contactRepository;
    this.contactUserRepository = contactUserRepository;
    this.isValidContactId = isValidContactId;
  }

  async execute(input) {
    const dto = input instanceof SetContactFollowUpDto
      ? input
      : new SetContactFollowUpDto(input);

    if (!this.isValidContactId(dto.id)) {
      throw new ContactInvalidIdError();
    }

    const followUpDate = dto.date ? new Date(dto.date) : null;
    const contact = await this.contactRepository.setFollowUpDateById({
      contactId: dto.id,
      followUpDate,
    });

    if (!contact) {
      throw new ContactNotFoundError();
    }

    const noteMessage = followUpDate
      ? `Follow-up date set to ${followUpDate.toLocaleDateString()}`
      : "Follow-up date cleared";

    await this.contactRepository.addAdminNote(contact, dto.adminId, noteMessage);

    const [populatedContact] = await this.populateUserData([contact]);

    return {
      success: true,
      data: populatedContact,
      message: noteMessage,
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
