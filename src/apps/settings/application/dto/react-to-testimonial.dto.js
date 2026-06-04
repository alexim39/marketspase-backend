export class ReactToTestimonialDto {
  constructor({ userId, testimonialId, reaction }) {
    this.userId = userId;
    this.testimonialId = testimonialId;
    this.reaction = reaction;
  }

  static fromRequest({ body, userId }) {
    return new ReactToTestimonialDto({
      userId,
      testimonialId: body?.testimonialId,
      reaction: body?.reaction,
    });
  }
}
