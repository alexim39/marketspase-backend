import {
  SettingsUserNotFoundError,
  SettingsValidationError,
} from "../../domain/errors/settings.errors.js";
import { UpdateThemePreferenceDto } from "../dto/update-theme-preference.dto.js";

export class UpdateThemePreferenceUseCase {
  constructor({ settingsUserRepository }) {
    this.settingsUserRepository = settingsUserRepository;
  }

  async execute(input) {
    const dto = input instanceof UpdateThemePreferenceDto
      ? input
      : new UpdateThemePreferenceDto(input);

    if (!dto.userId) {
      throw new SettingsValidationError("User ID is required");
    }

    if (!dto.preferences?.theme || typeof dto.preferences.theme !== "object") {
      throw new SettingsValidationError("Theme preferences are required");
    }

    const data = await this.settingsUserRepository.updateThemePreference({
      userId: dto.userId,
      theme: dto.preferences.theme,
    });

    if (!data) {
      throw new SettingsUserNotFoundError();
    }

    return {
      success: true,
      message: "Theme preferences updated successfully",
      data,
    };
  }
}
