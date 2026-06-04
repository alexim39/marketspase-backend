import { GetRandomDashboardTestimonialsDto } from "../dto/get-random-dashboard-testimonials.dto.js";

export class GetRandomDashboardTestimonialsUseCase {
  constructor({ settingsTestimonialRepository }) {
    this.settingsTestimonialRepository = settingsTestimonialRepository;
  }

  async execute(input) {
    const dto = input instanceof GetRandomDashboardTestimonialsDto
      ? input
      : new GetRandomDashboardTestimonialsDto(input);

    const count = parseInt(dto.count, 10) || 10;
    const testimonials = await this.settingsTestimonialRepository.findRandomDashboardTestimonials(count);

    return {
      data: testimonials,
      success: true,
    };
  }
}
