import { UserModel } from '../../user/models/user.model.js';



export const UpdateAdPreferences = async (req, res) => {
  const { userId, preferences } = req.body;

  // Validate required fields
  if (!userId || !preferences) {
    return res.status(400).json({
      success: false,
      message: 'User ID and preferences are required'
    });
  }

  // Get user data
  const user = await UserModel.findById(userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // Verify authorization
  if (userId !== user._id.toString() && user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update these preferences'
    });
  }

  try {
    // Build update object dynamically with only provided fields
    const updateFields = {};
    
    if (preferences.notification !== undefined) {
      updateFields['preferences.notification'] = preferences.notification;
    }
    
    if (preferences.categoryBasedAds !== undefined) {
      updateFields['preferences.categoryBasedAds'] = preferences.categoryBasedAds;
    }
    
    if (preferences.locationBasedAds !== undefined) {
      updateFields['preferences.locationBasedAds'] = preferences.locationBasedAds;
    }
    
    if (preferences.adCategories !== undefined) {
      updateFields['preferences.adCategories'] = Array.isArray(preferences.adCategories) 
        ? preferences.adCategories 
        : [];
    }

    // If no valid fields to update
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid preference fields to update'
      });
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { 
        new: true,
        runValidators: true 
      }
    ).select('preferences');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Ad preferences updated successfully',
      data: {
        preferences: updatedUser.preferences
      }
    });

  } catch (error) {
    console.error('Error updating ad preferences:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while updating preferences',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
};