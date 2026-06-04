import { ToggleNotificationDto } from "../application/dto/toggle-notification.dto.js";
import { ToggleNotificationUseCase } from "../application/use-cases/toggle-notification.use-case.js";
import {
  SettingsUserNotFoundError,
  SettingsValidationError,
} from "../domain/errors/settings.errors.js";
import { MongooseSettingsUserRepository } from "../infrastructure/repositories/mongoose-settings-user.repository.js";
import { UserModel } from "../../user/models/user/index.js";

const toggleNotificationUseCase = new ToggleNotificationUseCase({
  settingsUserRepository: new MongooseSettingsUserRepository(),
});

// Toggle notification
export const legacyToggleNotification = async (req, res) => {
  try {
    const { state, userId } = req.body;

    // Validate input
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    if (typeof state !== 'boolean') {
      return res.status(400).json({ message: 'State must be a boolean' });
    }

    // Find the partner by ID
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update the notification setting
    user.preferences.notification = state;
    await user.save();

    
    // set log activity
    await user.logActivity('notification_settings_update', `You ${state ? 'enabled' : 'disabled'} notification settings`, {});

    res.status(200).json({
      message: `Notifications ${state ? 'enabled' : 'disabled'} successfully`,
      data: {
        userId: user._id,
        notificationState: user.notification,
      },
      success: true,
    });
  } catch (error) {
    console.error('Error updating notification setting:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const toggleNotification = async (req, res) => {
  if (process.env.SETTINGS_DDD_ENABLED === 'false') {
    return legacyToggleNotification(req, res);
  }

  try {
    const result = await toggleNotificationUseCase.execute(
      ToggleNotificationDto.fromRequest({ body: req.body })
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof SettingsValidationError) {
      if (error.message === 'State must be a boolean') {
        return res.status(400).json({ message: 'State must be a boolean' });
      }

      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error instanceof SettingsUserNotFoundError) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.error('Error updating notification setting:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


