export class SaveNewsletterDraftDto {
  constructor({ id }) {
    this.id = id;
  }

  static fromRequest({ params }) {
    return new SaveNewsletterDraftDto({
      id: params?.id,
    });
  }
}
