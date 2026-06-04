import { UserModel } from "../../../user/models/user/index.js";

export class MongooseSettingsUserRepository {
  async updateNotificationPreference({ userId, state }) {
    const user = await UserModel.findById(userId);

    if (!user) {
      return null;
    }

    user.preferences.notification = state;
    await user.save();

    await user.logActivity(
      "notification_settings_update",
      `You ${state ? "enabled" : "disabled"} notification settings`,
      {},
    );

    return {
      userId: user._id,
      notificationState: user.notification,
    };
  }

  async updateThemePreference({ userId, theme }) {
    const user = await UserModel.findById(userId);

    if (!user) {
      return null;
    }

    user.preferences.theme = {
      ...user.preferences.theme,
      ...theme,
    };

    await user.save({
      validateBeforeSave: true,
      validateModifiedOnly: true,
    });

    return {
      theme: user.preferences.theme,
    };
  }

  async findPreferencesByUserId(userId) {
    const user = await UserModel.findById(userId).select("preferences");

    if (!user) {
      return null;
    }

    return user.preferences;
  }

  async updateAdPreference({ userId, updateFields }) {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      {
        new: true,
        runValidators: true,
      },
    ).select("preferences");

    if (!user) {
      return null;
    }

    return {
      preferences: user.preferences,
    };
  }
}
