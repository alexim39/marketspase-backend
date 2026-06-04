import {
  ContactInvalidIdError,
  ContactInvalidTagsValueError,
  ContactNotFoundError,
} from "../../domain/errors/contact.errors.js";
import { UpdateContactTagsDto } from "../dto/update-contact-tags.dto.js";

export class UpdateContactTagsUseCase {
  constructor({ contactRepository, contactUserRepository, isValidContactId }) {
    this.contactRepository = contactRepository;
    this.contactUserRepository = contactUserRepository;
    this.isValidContactId = isValidContactId;
  }

  async execute(input) {
    const dto = input instanceof UpdateContactTagsDto
      ? input
      : new UpdateContactTagsDto(input);

    if (!this.isValidContactId(dto.id)) {
      throw new ContactInvalidIdError();
    }

    if (!Array.isArray(dto.tags)) {
      throw new ContactInvalidTagsValueError();
    }

    const cleanedTags = dto.tags
      .map((tag) => tag.trim())
      .filter((tag) => tag !== "");

    const contact = await this.contactRepository.setTagsById({
      contactId: dto.id,
      tags: cleanedTags,
    });

    if (!contact) {
      throw new ContactNotFoundError();
    }

    await this.contactRepository.addAdminNote(
      contact,
      dto.adminId,
      `Tags updated: ${cleanedTags.join(", ") || "No tags"}`,
    );

    const [populatedContact] = await this.populateUserData([contact]);

    return {
      success: true,
      data: populatedContact,
      message: "Tags updated successfully",
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
