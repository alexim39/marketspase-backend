import { GetAdminTestimonialsDto } from "../dto/get-admin-testimonials.dto.js";

export class GetAdminTestimonialsUseCase {
  constructor({ settingsTestimonialRepository }) {
    this.settingsTestimonialRepository = settingsTestimonialRepository;
  }

  async execute(input) {
    const dto = input instanceof GetAdminTestimonialsDto
      ? input
      : new GetAdminTestimonialsDto(input);

    const filter = {};

    if (dto.status && dto.status !== "all") {
      filter.status = dto.status;
    }

    if (dto.rating && dto.rating !== "all") {
      filter.rating = parseInt(dto.rating);
    }

    if (dto.featured !== undefined) {
      filter.isFeatured = dto.featured === "true";
    }

    const pageNum = parseInt(dto.page);
    const limitNum = parseInt(dto.limit);
    const skip = (pageNum - 1) * limitNum;

    const { testimonials, total } = await this.settingsTestimonialRepository.findAdminTestimonials({
      filter,
      skip,
      limit: limitNum,
    });

    return {
      data: testimonials,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      total,
      success: true,
      message: "Testimonials found",
    };
  }
}
