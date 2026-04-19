// settings.controller.js (add this method)

import { UserModel } from '../../user/models/user/index.js';

export const updateThemePreferences = async (req, res) => {
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