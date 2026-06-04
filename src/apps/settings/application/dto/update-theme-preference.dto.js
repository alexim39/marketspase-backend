export class UpdateThemePreferenceDto {
  constructor({ userId, preferences }) {
    this.userId = userId;
    this.preferences = preferences;
  }

  static fromRequest({ body, targetUserId }) {
    return new UpdateThemePreferenceDto({
      userId: targetUserId,
      preferences: body?.preferences,
    });
  }
}
