export class UpdateAdPreferenceDto {
  constructor({ userId, preferences }) {
    this.userId = userId;
    this.preferences = preferences;
  }

  static fromRequest({ body, targetUserId }) {
    return new UpdateAdPreferenceDto({
      userId: targetUserId,
      preferences: body?.preferences,
    });
  }
}
