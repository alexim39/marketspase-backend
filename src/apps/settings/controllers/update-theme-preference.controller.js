import { UpdateThemePreferenceDto } from '../application/dto/update-theme-preference.dto.js';
import { UpdateThemePreferenceUseCase } from '../application/use-cases/update-theme-preference.use-case.js';
import {
  SettingsUserNotFoundError,
  SettingsValidationError,
} from '../domain/errors/settings.errors.js';
import { MongooseSettingsUserRepository } from '../infrastructure/repositories/mongoose-settings-user.repository.js';
import { UserModel } from '../../user/models/user/index.js';
import {
  ensureSelfOrAdmin,
  getAuthenticatedUserId,
} from '../../../shared/utils/request-auth.util.js';

const updateThemePreferenceUseCase = new UpdateThemePreferenceUseCase({
  settingsUserRepository: new MongooseSettingsUserRepository(),
});

export const legacyUpdateThemePreferences = async (req, res) => {
  try {
    const { userId, preferences } = req.body || {};
    const targetUserId = userId || getAuthenticatedUserId(req);

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    if (!ensureSelfOrAdmin(req, targetUserId, res, 'Not authorized to update these preferences')) {
      return;
    }

    if (!preferences?.theme || typeof preferences.theme !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Theme preferences are required'
      });
    }

    const user = await UserModel.findById(targetUserId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update only theme preferences
    user.preferences.theme = {
      ...user.preferences.theme,
      ...preferences.theme
    };

    // Save with validation options
    await user.save({ 
      validateBeforeSave: true,
      validateModifiedOnly: true  // Only validate modified paths
    });

    res.status(200).json({
      success: true,
      message: 'Theme preferences updated successfully',
      data: {
        theme: user.preferences.theme
      }
    });

  } catch (error) {
    console.error('Error updating theme preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const updateThemePreferences = async (req, res) => {
  if (process.env.SETTINGS_DDD_ENABLED === 'false') {
    return legacyUpdateThemePreferences(req, res);
  }

  try {
    const { userId } = req.body || {};
    const targetUserId = userId || getAuthenticatedUserId(req);

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    if (!ensureSelfOrAdmin(req, targetUserId, res, 'Not authorized to update these preferences')) {
      return;
    }

    const result = await updateThemePreferenceUseCase.execute(
      UpdateThemePreferenceDto.fromRequest({
        body: req.body,
        targetUserId,
      })
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof SettingsValidationError) {
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

    console.error('Error updating theme preferences:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/* export const updateThemePreferences = async (req, res) => {
  try {
    const { userId, preferences } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update theme preferences
    user.preferences.theme = {
      ...user.preferences.theme,
      ...preferences.theme
    };

    await user.save();


    // Log the theme change activity
    // await user.logActivity(
    //   'theme_updated', 
    //   `User updated theme preferences: ${preferences.theme.darkMode ? 'Dark' : 'Light'} mode, ${preferences.theme.systemDefault ? 'System default' : 'Manual'}, ${preferences.theme.highContrast ? 'High contrast' : 'Standard contrast'}`,
    //   {
    //     resourceType: 'user_preferences',
    //     resourceId: user._id,
    //     metadata: preferences.theme
    //   }
    // );

    res.status(200).json({
      success: true,
      message: 'Theme preferences updated successfully, reload to apply changes.',
      data: {
        theme: user.preferences.theme
      }
    });

  } catch (error) {
    console.error('Error updating theme preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}; */
