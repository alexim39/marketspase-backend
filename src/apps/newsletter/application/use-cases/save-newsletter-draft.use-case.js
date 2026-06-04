import { NewsletterNotFoundError } from "../../domain/errors/newsletter.errors.js";
import { SaveNewsletterDraftDto } from "../dto/save-newsletter-draft.dto.js";

export class SaveNewsletterDraftUseCase {
  constructor({ newsletterRepository }) {
    this.newsletterRepository = newsletterRepository;
  }

  async execute(input) {
    const dto = input instanceof SaveNewsletterDraftDto
      ? input
      : new SaveNewsletterDraftDto(input);

    const newsletter = await this.newsletterRepository.saveAsDraftById(dto.id);
    if (!newsletter) {
      throw new NewsletterNotFoundError();
    }

    return {
      success: true,
      data: newsletter,
      message: "Newsletter saved as draft successfully",
    };
  }
}
