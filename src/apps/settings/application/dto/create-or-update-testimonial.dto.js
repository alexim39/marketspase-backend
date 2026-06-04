export class CreateOrUpdateTestimonialDto {
  constructor({ userId, message, rating = 5 }) {
    this.userId = userId;
    this.message = message;
    this.rating = rating;
  }

  static fromRequest({ body, candidateUserId }) {
    return new CreateOrUpdateTestimonialDto({
      userId: candidateUserId,
      message: body?.message,
      rating: body?.rating ?? 5,
    });
  }
}
