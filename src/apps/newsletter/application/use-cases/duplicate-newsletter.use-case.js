import { NewsletterNotFoundError } from "../../domain/errors/newsletter.errors.js";
import { DuplicateNewsletterDto } from "../dto/duplicate-newsletter.dto.js";

export class DuplicateNewsletterUseCase {
  constructor({ newsletterRepository }) {
    this.newsletterRepository = newsletterRepository;
  }

  async execute(input) {
    const dto = input instanceof DuplicateNewsletterDto
      ? input
      : new DuplicateNewsletterDto(input);

    const duplicatedNewsletter = await this.newsletterRepository.duplicateById(dto.id);
    if (!duplicatedNewsletter) {
      throw new NewsletterNotFoundError();
    }

    return {
      success: true,
      data: duplicatedNewsletter,
      message: "Newsletter duplicated successfully",
    };
  }
}
