export class DuplicateNewsletterDto {
  constructor({ id }) {
    this.id = id;
  }

  static fromRequest({ params }) {
    return new DuplicateNewsletterDto({
      id: params?.id,
    });
  }
}
