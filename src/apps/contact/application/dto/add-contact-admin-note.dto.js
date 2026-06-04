export class AddContactAdminNoteDto {
  constructor({ id, note, adminId }) {
    this.id = id;
    this.note = note;
    this.adminId = adminId;
  }

  static fromRequest({ params, body, user }) {
    return new AddContactAdminNoteDto({
      id: params?.id,
      note: body?.note,
      adminId: user?._id,
    });
  }
}
