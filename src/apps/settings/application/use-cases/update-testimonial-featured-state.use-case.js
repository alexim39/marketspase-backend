import { SettingsTestimonialNotFoundError } from "../../domain/errors/settings.errors.js";
import { UpdateTestimonialFeaturedStateDto } from "../dto/update-testimonial-featured-state.dto.js";

export class UpdateTestimonialFeaturedStateUseCase {
  constructor({ settingsTestimonialRepository }) {
    this.settingsTestimonialRepository = settingsTestimonialRepository;
  }

  async execute(input) {
    const dto = input instanceof UpdateTestimonialFeaturedStateDto
      ? input
      : new UpdateTestimonialFeaturedStateDto(input);

    const testimonial = await this.settingsTestimonialRepository.updateTestimonialFeaturedState({
      testimonialId: dto.testimonialId,
      isFeatured: dto.isFeatured,
    });

    if (!testimonial) {
      throw new SettingsTestimonialNotFoundError();
    }

    return testimonial;
  }
}
