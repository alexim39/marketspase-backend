export class DeleteNewsletterDto {
  constructor({ id }) {
    this.id = id;
  }

  static fromRequest({ params }) {
    return new DeleteNewsletterDto({
      id: params?.id,
    });
  }
}
