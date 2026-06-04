import { NewsletterNotFoundError } from "../../domain/errors/newsletter.errors.js";
import { UpdateNewsletterDto } from "../dto/update-newsletter.dto.js";

export class UpdateNewsletterUseCase {
  constructor({ newsletterRepository }) {
    this.newsletterRepository = newsletterRepository;
  }

  async execute(input) {
    const dto = input instanceof UpdateNewsletterDto
      ? input
      : new UpdateNewsletterDto(input);

    const newsletter = await this.newsletterRepository.updateById(
      dto.id,
      dto.newsletterData,
    );

    if (!newsletter) {
      throw new NewsletterNotFoundError();
    }

    return {
      success: true,
      data: newsletter,
      message: "Newsletter updated successfully",
    };
  }
}
