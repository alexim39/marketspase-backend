export class SetContactFollowUpDto {
  constructor({ id, date, adminId }) {
    this.id = id;
    this.date = date;
    this.adminId = adminId;
  }

  static fromRequest({ params, body, user }) {
    return new SetContactFollowUpDto({
      id: params?.id,
      date: body?.date,
      adminId: user?._id,
    });
  }
}
