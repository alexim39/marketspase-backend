import { CONTACT_STATUS, CONTACT_STATUS_ARRAY } from "../../domain/contact.constants.js";
import {
  ContactIdsRequiredError,
  ContactInvalidStatusValueError,
  ContactNoValidIdsError,
} from "../../domain/errors/contact.errors.js";
import { BulkUpdateContactStatusDto } from "../dto/bulk-update-contact-status.dto.js";

export class BulkUpdateContactStatusUseCase {
  constructor({ contactRepository, isValidContactId }) {
    this.contactRepository = contactRepository;
    this.isValidContactId = isValidContactId;
  }

  async execute(input) {
    const dto = input instanceof BulkUpdateContactStatusDto
      ? input
      : new BulkUpdateContactStatusDto(input);

    if (!Array.isArray(dto.ids) || dto.ids.length === 0) {
      throw new ContactIdsRequiredError();
    }

    if (!CONTACT_STATUS_ARRAY.includes(dto.status)) {
      throw new ContactInvalidStatusValueError();
    }

    const validIds = dto.ids.filter((id) => this.isValidContactId(id));
    if (validIds.length === 0) {
      throw new ContactNoValidIdsError();
    }

    const result = await this.contactRepository.bulkSetStatusByIds({
      contactIds: validIds,
      updateData: this.buildUpdateData(dto.status),
    });

    await this.addAdminNotes({
      contactIds: validIds,
      adminId: dto.adminId,
      status: dto.status,
    });

    return {
      success: true,
      message: `Updated ${result.modifiedCount} contacts`,
      updatedCount: result.modifiedCount,
    };
  }

  buildUpdateData(status) {
    const updateData = { status };

    if (status === CONTACT_STATUS.RESOLVED || status === CONTACT_STATUS.CLOSED) {
      updateData.resolvedAt = new Date();
    } else {
      updateData.resolvedAt = null;
    }

    return updateData;
  }

  async addAdminNotes({ contactIds, adminId, status }) {
    for (const contactId of contactIds) {
      const contact = await this.contactRepository.findById(contactId);
      if (contact) {
        await this.contactRepository.addAdminNote(
          contact,
          adminId,
          `Bulk status update: Changed to ${status}`,
        );
      }
    }
  }
}
