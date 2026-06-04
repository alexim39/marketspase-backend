export class CancelNewsletterScheduleDto {
  constructor({ id }) {
    this.id = id;
  }

  static fromRequest({ params }) {
    return new CancelNewsletterScheduleDto({
      id: params?.id,
    });
  }
}
