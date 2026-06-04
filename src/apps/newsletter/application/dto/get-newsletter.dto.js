export class GetNewsletterDto {
  constructor({ id }) {
    this.id = id;
  }

  static fromRequest({ params }) {
    return new GetNewsletterDto({
      id: params?.id,
    });
  }
}
