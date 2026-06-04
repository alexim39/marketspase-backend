export class DeleteBadgeDefinitionDto {
  constructor({ adminId, badgeId } = {}) {
    this.adminId = adminId;
    this.badgeId = badgeId;
  }

  static fromRequest({ adminId, badgeId } = {}) {
    return new DeleteBadgeDefinitionDto({ adminId, badgeId });
  }
}
