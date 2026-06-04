import {
  SettingsUserNotFoundError,
  SettingsValidationError,
} from "../../domain/errors/settings.errors.js";
import { CreateOrUpdateTestimonialDto } from "../dto/create-or-update-testimonial.dto.js";

export class CreateOrUpdateTestimonialUseCase {
  constructor({ settingsTestimonialRepository }) {
    this.settingsTestimonialRepository = settingsTestimonialRepository;
  }

  async execute(input) {
    const dto = input instanceof CreateOrUpdateTestimonialDto
      ? input
      : new CreateOrUpdateTestimonialDto(input);

    if (!dto.message) {
      throw new SettingsValidationError("Testimonial message is required");
    }

    if (dto.rating < 1 || dto.rating > 5) {
      throw new SettingsValidationError("Rating must be between 1 and 5");
    }

    const user = await this.settingsTestimonialRepository.findTestimonialUserById(dto.userId);

    if (!user) {
      throw new SettingsUserNotFoundError();
    }

    const existingTestimonial = await this.settingsTestimonialRepository.findActiveTestimonialByUser(dto.userId);
    let testimonial;

    if (existingTestimonial) {
      testimonial = await this.settingsTestimonialRepository.updateTestimonialSubmission({
        testimonialId: existingTestimonial._id,
        message: dto.message,
        rating: dto.rating,
        status: "pending",
      });
    } else {
      testimonial = await this.settingsTestimonialRepository.createTestimonialSubmission({
        userId: dto.userId,
        message: dto.message,
        rating: dto.rating,
        status: "pending",
      });

      await this.settingsTestimonialRepository.addUserTestimonialReference({
        userId: dto.userId,
        testimonialId: testimonial._id,
      });
    }

    return {
      success: true,
      message: "Testimonial submitted successfully and pending approval",
      testimonial: {
        _id: testimonial._id,
        message: testimonial.message,
        rating: testimonial.rating,
        status: testimonial.status,
        createdAt: testimonial.createdAt,
      },
    };
  }
}
