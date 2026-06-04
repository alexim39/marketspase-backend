export class UpdateContactPriorityDto {
  constructor({ id, priority, adminId }) {
    this.id = id;
    this.priority = priority;
    this.adminId = adminId;
  }

  static fromRequest({ params, body, user }) {
    return new UpdateContactPriorityDto({
      id: params?.id,
      priority: body?.priority,
      adminId: user?._id,
    });
  }
}
