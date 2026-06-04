import { CONTACT_ASSIGNABLE_ADMIN_ROLES } from "../../domain/contact.constants.js";
import {
  ContactInvalidAdminIdError,
  ContactInvalidAdminUserError,
  ContactInvalidIdError,
  ContactNotFoundError,
} from "../../domain/errors/contact.errors.js";
import { AssignContactToAdminDto } from "../dto/assign-contact-to-admin.dto.js";

export class AssignContactToAdminUseCase {
  constructor({
    contactRepository,
    contactUserRepository,
    isValidContactId,
    isValidAdminId,
  }) {
    this.contactRepository = contactRepository;
    this.contactUserRepository = contactUserRepository;
    this.isValidContactId = isValidContactId;
    this.isValidAdminId = isValidAdminId;
  }

  async execute(input) {
    const dto = input instanceof AssignContactToAdminDto
      ? input
      : new AssignContactToAdminDto(input);

    if (!this.isValidContactId(dto.id)) {
      throw new ContactInvalidIdError();
    }

    let noteMessage = "Unassigned from admin";
    let assigneeId = null;

    if (dto.assigneeId) {
      if (!this.isValidAdminId(dto.assigneeId)) {
        throw new ContactInvalidAdminIdError();
      }

      const admin = await this.contactUserRepository.findContactAdminById(dto.assigneeId);
      if (!admin || !CONTACT_ASSIGNABLE_ADMIN_ROLES.includes(admin.role)) {
        throw new ContactInvalidAdminUserError();
      }

      assigneeId = dto.assigneeId;
      noteMessage = `Assigned to ${admin.displayName}`;
    }

    const contact = await this.contactRepository.assignToAdminById({
      contactId: dto.id,
      assigneeId,
    });

    if (!contact) {
      throw new ContactNotFoundError();
    }

    await this.contactRepository.addAdminNote(
      contact,
      dto.actorAdminId,
      noteMessage,
    );

    const [populatedContact] = await this.populateUserData([contact]);

    return {
      success: true,
      data: populatedContact,
      message: dto.assigneeId ? "Contact assigned successfully" : "Contact unassigned",
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
