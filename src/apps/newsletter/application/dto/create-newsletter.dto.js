export class CreateNewsletterDto {
  constructor({ newsletterData }) {
    this.newsletterData = newsletterData;
  }

  static fromRequest({ body }) {
    return new CreateNewsletterDto({
      newsletterData: body,
    });
  }
}
