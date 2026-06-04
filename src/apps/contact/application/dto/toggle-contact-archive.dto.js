export class ToggleContactArchiveDto {
  constructor({ id, archived, adminId }) {
    this.id = id;
    this.archived = archived;
    this.adminId = adminId;
  }

  static fromRequest({ params, body, user }) {
    return new ToggleContactArchiveDto({
      id: params?.id,
      archived: body?.archived,
      adminId: user?._id,
    });
  }
}
