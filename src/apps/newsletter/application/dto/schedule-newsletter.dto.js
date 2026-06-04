export class ScheduleNewsletterDto {
  constructor({ id, scheduledDate }) {
    this.id = id;
    this.scheduledDate = scheduledDate;
  }

  static fromRequest({ params, body }) {
    return new ScheduleNewsletterDto({
      id: params?.id,
      scheduledDate: body?.scheduledDate,
    });
  }
}
