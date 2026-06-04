export class UpdateNewsletterDto {
  constructor({ id, newsletterData }) {
    this.id = id;
    this.newsletterData = newsletterData;
  }

  static fromRequest({ params, body }) {
    return new UpdateNewsletterDto({
      id: params?.id,
      newsletterData: body,
    });
  }
}
