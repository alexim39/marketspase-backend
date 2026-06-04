import {
  SettingsTestimonialNotFoundError,
  SettingsValidationError,
} from "../../domain/errors/settings.errors.js";
import { UpdateTestimonialStatusDto } from "../dto/update-testimonial-status.dto.js";

const ALLOWED_STATUSES = ["pending", "approved", "rejected"];

export class UpdateTestimonialStatusUseCase {
  constructor({ settingsTestimonialRepository }) {
    this.settingsTestimonialRepository = settingsTestimonialRepository;
  }

  async execute(input) {
    const dto = input instanceof UpdateTestimonialStatusDto
      ? input
      : new UpdateTestimonialStatusDto(input);

    if (!ALLOWED_STATUSES.includes(dto.status)) {
      throw new SettingsValidationError("Invalid status value");
    }

    const testimonial = await this.settingsTestimonialRepository.updateTestimonialStatus({
      testimonialId: dto.testimonialId,
      status: dto.status,
      reviewedBy: dto.reviewedBy,
      reviewedAt: new Date(),
    });

    if (!testimonial) {
      throw new SettingsTestimonialNotFoundError();
    }

    if (testimonial?.user?._id) {
      await this.settingsTestimonialRepository.syncUserTestimonials(testimonial.user._id);
    }

    return testimonial;
  }
}
