import { NewsletterActionRejectedError } from "../../domain/errors/newsletter.errors.js";
import { CancelNewsletterScheduleDto } from "../dto/cancel-newsletter-schedule.dto.js";

export class CancelNewsletterScheduleUseCase {
  constructor({ newsletterRepository }) {
    this.newsletterRepository = newsletterRepository;
  }

  async execute(input) {
    const dto = input instanceof CancelNewsletterScheduleDto
      ? input
      : new CancelNewsletterScheduleDto(input);

    try {
      const newsletter = await this.newsletterRepository.findById(dto.id);

      if (!newsletter) {
        throw new NewsletterActionRejectedError("Newsletter not found");
      }

      if (newsletter.status !== "scheduled") {
        throw new NewsletterActionRejectedError("Newsletter is not scheduled");
      }

      const cancelledNewsletter = await this.newsletterRepository.cancelScheduleById(dto.id);
      if (!cancelledNewsletter) {
        throw new NewsletterActionRejectedError("Newsletter not found");
      }

      return {
        success: true,
        data: cancelledNewsletter,
        message: "Scheduled newsletter cancelled successfully",
      };
    } catch (error) {
      if (error instanceof NewsletterActionRejectedError) {
        throw error;
      }

      throw new NewsletterActionRejectedError("Failed to cancel scheduled newsletter");
    }
  }
}
