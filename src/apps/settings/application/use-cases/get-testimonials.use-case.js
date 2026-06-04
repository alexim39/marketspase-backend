import { SettingsValidationError } from "../../domain/errors/settings.errors.js";
import { GetTestimonialsDto } from "../dto/get-testimonials.dto.js";

const ALLOWED_STATUSES = ["pending", "approved", "rejected"];

export class GetTestimonialsUseCase {
  constructor({ settingsTestimonialRepository }) {
    this.settingsTestimonialRepository = settingsTestimonialRepository;
  }

  async execute(input) {
    const dto = input instanceof GetTestimonialsDto
      ? input
      : new GetTestimonialsDto(input);

    if (!ALLOWED_STATUSES.includes(dto.status)) {
      throw new SettingsValidationError("Invalid status filter");
    }

    const limitNum = parseInt(dto.limit);
    const pageNum = parseInt(dto.page);
    const skip = (pageNum - 1) * limitNum;
    const filter = {
      status: dto.status,
      isDeleted: false,
    };

    const { testimonials, total } = await this.settingsTestimonialRepository.findTestimonials({
      filter,
      skip,
      limit: limitNum,
      sort: { createdAt: -1 },
    });

    return {
      success: true,
      testimonials,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    };
  }
}
