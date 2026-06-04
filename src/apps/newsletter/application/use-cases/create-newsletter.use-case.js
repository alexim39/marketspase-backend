import { NewsletterActionRejectedError } from "../../domain/errors/newsletter.errors.js";
import { CreateNewsletterDto } from "../dto/create-newsletter.dto.js";

export class CreateNewsletterUseCase {
  constructor({ newsletterRepository }) {
    this.newsletterRepository = newsletterRepository;
  }

  async execute(input) {
    const dto = input instanceof CreateNewsletterDto
      ? input
      : new CreateNewsletterDto(input);

    if (!dto.newsletterData?.subject || !dto.newsletterData?.content) {
      throw new NewsletterActionRejectedError("Subject and content are required");
    }

    const newsletter = await this.newsletterRepository.create(dto.newsletterData);

    return {
      success: true,
      data: newsletter,
      message: "Newsletter created successfully",
    };
  }
}
