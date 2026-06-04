import { GetNewslettersDto } from "../dto/get-newsletters.dto.js";

export class GetNewslettersUseCase {
  constructor({ newsletterRepository }) {
    this.newsletterRepository = newsletterRepository;
  }

  async execute(input) {
    const dto = input instanceof GetNewslettersDto
      ? input
      : new GetNewslettersDto(input);

    const filter = this.buildFilter(dto);
    const page = parseInt(dto.page);
    const limit = parseInt(dto.limit);
    const skip = (page - 1) * limit;

    const [newsletters, total] = await Promise.all([
      this.newsletterRepository.findNewsletters({
        filter,
        skip,
        limit,
        sort: { createdAt: -1 },
      }),
      this.newsletterRepository.countByFilter(filter),
    ]);

    return {
      success: true,
      data: newsletters,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
      message: "Newsletters retrieved successfully",
    };
  }

  buildFilter(dto) {
    const filter = { isDeleted: false };

    if (dto.status && dto.status !== "all") {
      filter.status = dto.status;
    }

    if (dto.search) {
      filter.$or = [
        { subject: { $regex: dto.search, $options: "i" } },
        { previewText: { $regex: dto.search, $options: "i" } },
        { title: { $regex: dto.search, $options: "i" } },
      ];
    }

    return filter;
  }
}
