import {
  ContactAdminNoteRequiredError,
  ContactInvalidIdError,
  ContactNotFoundError,
} from "../../domain/errors/contact.errors.js";
import { AddContactAdminNoteDto } from "../dto/add-contact-admin-note.dto.js";

export class AddContactAdminNoteUseCase {
  constructor({ contactRepository, contactUserRepository, isValidContactId }) {
    this.contactRepository = contactRepository;
    this.contactUserRepository = contactUserRepository;
    this.isValidContactId = isValidContactId;
  }

  async execute(input) {
    const dto = input instanceof AddContactAdminNoteDto
      ? input
      : new AddContactAdminNoteDto(input);

    if (!this.isValidContactId(dto.id)) {
      throw new ContactInvalidIdError();
    }

    const cleanedNote = typeof dto.note === "string" ? dto.note.trim() : "";
    if (!cleanedNote) {
      throw new ContactAdminNoteRequiredError();
    }

    const contact = await this.contactRepository.findById(dto.id);
    if (!contact) {
      throw new ContactNotFoundError();
    }

    await this.contactRepository.addAdminNote(contact, dto.adminId, cleanedNote);

    const updatedContact = await this.contactRepository.findByIdWithWorkflowDetails(dto.id);
    const [populatedContact] = await this.populateUserData([updatedContact]);

    return {
      success: true,
      data: populatedContact,
      message: "Note added successfully",
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
