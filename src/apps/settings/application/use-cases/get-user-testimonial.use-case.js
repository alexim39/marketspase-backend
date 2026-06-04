import { GetUserTestimonialDto } from "../dto/get-user-testimonial.dto.js";

const toStringId = (value) => {
  if (value === undefined || value === null) {
    return value;
  }

  return value.toString();
};

const formatUser = (user) => {
  if (!user) {
    return null;
  }

  return {
    _id: user._id,
    name: user.displayName || user.username || "MarketSpase User",
    username: user.username,
    avatar: user.avatar,
    state: user.personalInfo?.address?.state,
    country: user.personalInfo?.address?.country,
    jobTitle: user.professionalInfo?.jobTitle,
  };
};

export class GetUserTestimonialUseCase {
  constructor({ settingsTestimonialRepository }) {
    this.settingsTestimonialRepository = settingsTestimonialRepository;
  }

  async execute(input) {
    const dto = input instanceof GetUserTestimonialDto
      ? input
      : new GetUserTestimonialDto(input);

    const testimonial = await this.settingsTestimonialRepository.findUserTestimonial(dto.userId);

    if (!testimonial) {
      return {
        success: true,
        data: null,
      };
    }

    let reactions = testimonial.reactions || [];
    const responseTestimonial = { ...testimonial };

    if (dto.currentUserId) {
      const reaction = reactions.find(
        (item) => item.userId && item.userId.toString() === dto.currentUserId.toString(),
      );

      responseTestimonial.userReaction = reaction ? reaction.reaction : null;
      reactions = reactions.map((item) => ({
        ...item,
        userId: toStringId(item.userId),
      }));
    }

    return {
      success: true,
      data: {
        ...responseTestimonial,
        _id: testimonial._id.toString(),
        user: formatUser(testimonial.user),
        reactions,
      },
    };
  }
}
