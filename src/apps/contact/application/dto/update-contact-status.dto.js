export class UpdateContactStatusDto {
  constructor({ id, status, notes, adminId }) {
    this.id = id;
    this.status = status;
    this.notes = notes;
    this.adminId = adminId;
  }

  static fromRequest({ params, body, user }) {
    return new UpdateContactStatusDto({
      id: params?.id,
      status: body?.status,
      notes: body?.notes,
      adminId: user?._id,
    });
  }
}
