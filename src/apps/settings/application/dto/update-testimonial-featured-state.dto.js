export class UpdateTestimonialFeaturedStateDto {
  constructor({ testimonialId, isFeatured }) {
    this.testimonialId = testimonialId;
    this.isFeatured = isFeatured;
  }

  static fromRequest({ params, body }) {
    return new UpdateTestimonialFeaturedStateDto({
      testimonialId: params?.id,
      isFeatured: body?.isFeatured,
    });
  }
}
