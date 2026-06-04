export class SettingsUserRepository {
  async updateNotificationPreference() {
    throw new Error("SettingsUserRepository.updateNotificationPreference must be implemented.");
  }

  async updateThemePreference() {
    throw new Error("SettingsUserRepository.updateThemePreference must be implemented.");
  }

  async findPreferencesByUserId() {
    throw new Error("SettingsUserRepository.findPreferencesByUserId must be implemented.");
  }

  async updateAdPreference() {
    throw new Error("SettingsUserRepository.updateAdPreference must be implemented.");
  }
}
