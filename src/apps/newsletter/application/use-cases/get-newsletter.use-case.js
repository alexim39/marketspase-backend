import { NewsletterNotFoundError } from "../../domain/errors/newsletter.errors.js";
import { GetNewsletterDto } from "../dto/get-newsletter.dto.js";

export class GetNewsletterUseCase {
  constructor({ newsletterRepository }) {
    this.newsletterRepository = newsletterRepository;
  }

  async execute(input) {
    const dto = input instanceof GetNewsletterDto
      ? input
      : new GetNewsletterDto(input);

    const newsletter = await this.newsletterRepository.findById(dto.id);
    if (!newsletter) {
      throw new NewsletterNotFoundError();
    }

    return {
      success: true,
      data: newsletter,
      message: "Newsletter retrieved successfully",
    };
  }
}
