export class UpdateContactTagsDto {
  constructor({ id, tags, adminId }) {
    this.id = id;
    this.tags = tags;
    this.adminId = adminId;
  }

  static fromRequest({ params, body, user }) {
    return new UpdateContactTagsDto({
      id: params?.id,
      tags: body?.tags,
      adminId: user?._id,
    });
  }
}
