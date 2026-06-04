import {
  SettingsUserNotFoundError,
  SettingsValidationError,
} from "../../domain/errors/settings.errors.js";
import { ToggleNotificationDto } from "../dto/toggle-notification.dto.js";

export class ToggleNotificationUseCase {
  constructor({ settingsUserRepository }) {
    this.settingsUserRepository = settingsUserRepository;
  }

  async execute(input) {
    const dto = input instanceof ToggleNotificationDto
      ? input
      : new ToggleNotificationDto(input);

    if (!dto.userId) {
      throw new SettingsValidationError("User ID is required");
    }

    if (typeof dto.state !== "boolean") {
      throw new SettingsValidationError("State must be a boolean");
    }

    const data = await this.settingsUserRepository.updateNotificationPreference({
      userId: dto.userId,
      state: dto.state,
    });

    if (!data) {
      throw new SettingsUserNotFoundError();
    }

    return {
      message: `Notifications ${dto.state ? "enabled" : "disabled"} successfully`,
      data,
      success: true,
    };
  }
}
