export class BulkUpdateContactStatusDto {
  constructor({ ids, status, adminId }) {
    this.ids = ids;
    this.status = status;
    this.adminId = adminId;
  }

  static fromRequest({ body, user }) {
    return new BulkUpdateContactStatusDto({
      ids: body?.ids,
      status: body?.status,
      adminId: user?._id,
    });
  }
}
