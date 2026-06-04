import { NewsletterNotFoundError } from "../../domain/errors/newsletter.errors.js";
import { DeleteNewsletterDto } from "../dto/delete-newsletter.dto.js";

export class DeleteNewsletterUseCase {
  constructor({ newsletterRepository }) {
    this.newsletterRepository = newsletterRepository;
  }

  async execute(input) {
    const dto = input instanceof DeleteNewsletterDto
      ? input
      : new DeleteNewsletterDto(input);

    const deleted = await this.newsletterRepository.softDeleteById(dto.id);
    if (!deleted) {
      throw new NewsletterNotFoundError();
    }

    return {
      success: true,
      data: null,
      message: "Newsletter deleted successfully",
    };
  }
}
