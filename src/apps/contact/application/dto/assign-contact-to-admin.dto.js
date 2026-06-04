export class AssignContactToAdminDto {
  constructor({ id, assigneeId, actorAdminId }) {
    this.id = id;
    this.assigneeId = assigneeId;
    this.actorAdminId = actorAdminId;
  }

  static fromRequest({ params, body, user }) {
    return new AssignContactToAdminDto({
      id: params?.id,
      assigneeId: body?.adminId,
      actorAdminId: user?._id,
    });
  }
}
