export class UpdateTestimonialStatusDto {
  constructor({ testimonialId, status, reviewedBy }) {
    this.testimonialId = testimonialId;
    this.status = status;
    this.reviewedBy = reviewedBy;
  }

  static fromRequest({ params, body, user }) {
    return new UpdateTestimonialStatusDto({
      testimonialId: params?.id,
      status: body?.status,
      reviewedBy: user?._id,
    });
  }
}
