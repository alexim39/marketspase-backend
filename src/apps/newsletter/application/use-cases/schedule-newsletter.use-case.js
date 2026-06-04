import { NewsletterActionRejectedError } from "../../domain/errors/newsletter.errors.js";
import { ScheduleNewsletterDto } from "../dto/schedule-newsletter.dto.js";

export class ScheduleNewsletterUseCase {
  constructor({ newsletterRepository }) {
    this.newsletterRepository = newsletterRepository;
  }

  async execute(input) {
    const dto = input instanceof ScheduleNewsletterDto
      ? input
      : new ScheduleNewsletterDto(input);

    if (!dto.scheduledDate) {
      throw new NewsletterActionRejectedError("Scheduled date is required");
    }

    const scheduledDate = new Date(dto.scheduledDate);

    try {
      const newsletter = await this.newsletterRepository.findById(dto.id);

      if (!newsletter) {
        throw new NewsletterActionRejectedError("Newsletter not found");
      }

      if (scheduledDate <= new Date()) {
        throw new NewsletterActionRejectedError("Scheduled date must be in the future");
      }

      const scheduledNewsletter = await this.newsletterRepository.scheduleById(
        dto.id,
        scheduledDate,
      );

      if (!scheduledNewsletter) {
        throw new NewsletterActionRejectedError("Newsletter not found");
      }

      return {
        success: true,
        data: scheduledNewsletter,
        message: "Newsletter scheduled successfully",
      };
    } catch (error) {
      if (error instanceof NewsletterActionRejectedError) {
        throw error;
      }

      throw new NewsletterActionRejectedError("Failed to schedule newsletter");
    }
  }
}
