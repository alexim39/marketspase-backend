export class DeleteTestimonialDto {
  constructor({ testimonialId }) {
    this.testimonialId = testimonialId;
  }

  static fromRequest({ params }) {
    return new DeleteTestimonialDto({
      testimonialId: params?.id,
    });
  }
}
