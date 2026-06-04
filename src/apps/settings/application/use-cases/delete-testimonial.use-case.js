import { SettingsTestimonialNotFoundError } from "../../domain/errors/settings.errors.js";
import { DeleteTestimonialDto } from "../dto/delete-testimonial.dto.js";

export class DeleteTestimonialUseCase {
  constructor({ settingsTestimonialRepository }) {
    this.settingsTestimonialRepository = settingsTestimonialRepository;
  }

  async execute(input) {
    const dto = input instanceof DeleteTestimonialDto
      ? input
      : new DeleteTestimonialDto(input);

    const testimonial = await this.settingsTestimonialRepository.deleteTestimonial(dto.testimonialId);

    if (!testimonial) {
      throw new SettingsTestimonialNotFoundError();
    }

    if (testimonial?.user) {
      await this.settingsTestimonialRepository.removeUserTestimonialReference({
        userId: testimonial.user,
        testimonialId: testimonial._id,
      });
    }

    return {
      success: true,
      message: "Testimonial deleted successfully",
    };
  }
}
