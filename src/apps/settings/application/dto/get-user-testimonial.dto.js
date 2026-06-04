export class GetUserTestimonialDto {
  constructor({ userId, currentUserId }) {
    this.userId = userId;
    this.currentUserId = currentUserId;
  }

  static fromRequest({ params, currentUserId }) {
    return new GetUserTestimonialDto({
      userId: params?.userId,
      currentUserId,
    });
  }
}
