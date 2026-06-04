export class SendNewsletterDto {
  constructor({ id }) {
    this.id = id;
  }

  static fromRequest({ params }) {
    return new SendNewsletterDto({
      id: params?.id,
    });
  }
}
