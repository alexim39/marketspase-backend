import {
  ContactInvalidIdError,
  ContactNotFoundError,
} from "../../domain/errors/contact.errors.js";
import { DeleteContactDto } from "../dto/delete-contact.dto.js";

export class DeleteContactUseCase {
  constructor({ contactRepository, isValidContactId }) {
    this.contactRepository = contactRepository;
    this.isValidContactId = isValidContactId;
  }

  async execute(input) {
    const dto = input instanceof DeleteContactDto
      ? input
      : new DeleteContactDto(input);

    if (!this.isValidContactId(dto.id)) {
      throw new ContactInvalidIdError();
    }

    const deletedContact = await this.contactRepository.deleteById(dto.id);
    if (!deletedContact) {
      throw new ContactNotFoundError();
    }

    return {
      success: true,
      message: "Contact message deleted successfully",
    };
  }
}
