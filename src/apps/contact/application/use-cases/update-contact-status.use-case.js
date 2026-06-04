import { CONTACT_STATUS, CONTACT_STATUS_ARRAY } from "../../domain/contact.constants.js";
import {
  ContactInvalidIdError,
  ContactInvalidStatusValueError,
  ContactNotFoundError,
} from "../../domain/errors/contact.errors.js";
import { UpdateContactStatusDto } from "../dto/update-contact-status.dto.js";

export class UpdateContactStatusUseCase {
  constructor({ contactRepository, contactUserRepository, isValidContactId }) {
    this.contactRepository = contactRepository;
    this.contactUserRepository = contactUserRepository;
    this.isValidContactId = isValidContactId;
  }

  async execute(input) {
    const dto = input instanceof UpdateContactStatusDto
      ? input
      : new UpdateContactStatusDto(input);

    if (!this.isValidContactId(dto.id)) {
      throw new ContactInvalidIdError();
    }

    if (!CONTACT_STATUS_ARRAY.includes(dto.status)) {
      throw new ContactInvalidStatusValueError();
    }

    const existingContact = await this.contactRepository.findById(dto.id);
    if (!existingContact) {
      throw new ContactNotFoundError();
    }

    const updateData = this.buildUpdateData(dto);
    const updatedContact = await this.contactRepository.setStatusById({
      contactId: dto.id,
      updateData,
    });

    if (dto.notes) {
      await this.contactRepository.addAdminNote(
        updatedContact,
        dto.adminId,
        `Status changed to ${dto.status}: ${dto.notes}`,
      );
    }

    const [populatedContact] = await this.populateUserData([updatedContact]);

    return {
      success: true,
      data: populatedContact,
      message: `Contact status updated to ${dto.status}`,
    };
  }

  buildUpdateData(dto) {
    const updateData = { status: dto.status };

    if (
      (dto.status === CONTACT_STATUS.RESOLVED || dto.status === CONTACT_STATUS.CLOSED) &&
      dto.notes
    ) {
      updateData.resolutionNotes = dto.notes;
      updateData.resolvedAt = new Date();
    }

    if (dto.status === CONTACT_STATUS.OPEN || dto.status === CONTACT_STATUS.IN_PROGRESS) {
      updateData.resolvedAt = null;

      if (!dto.notes) {
        updateData.resolutionNotes = "";
      }
    }

    return updateData;
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
