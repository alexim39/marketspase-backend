import { UserModel } from '../../models/user.model.js';
import mongoose from 'mongoose';

// controllers/user.controller.js - Fix for the display name update
export const updateUserDisplayName = (req, res) => {
  const { userId } = req.params;
  const { displayName } = req.body;

  // Validate input
  if (!displayName || displayName.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Display name is required'
    });
  }

  const trimmedName = displayName.trim();
  
  if (trimmedName.length < 2 || trimmedName.length > 50) {
    return res.status(400).json({
      success: false,
      message: 'Display name must be between 2 and 50 characters'
    });
  }

  // Basic validation for display name format
  const nameRegex = /^[a-zA-Z0-9\s\-_]+$/;
  if (!nameRegex.test(trimmedName)) {
    return res.status(400).json({
      success: false,
      message: 'Display name can only contain letters, numbers, spaces, hyphens, and underscores'
    });
  }

  try {
    // 1. AWAIT the query to get the User DOCUMENT
    const user = UserModel.findByIdAndUpdate(
        userId,
        { displayName: trimmedName },
        { new: true, runValidators: true }
    )
    .select('-password -__v -authenticationMethod')
    .exec(); // Explicitly executing the query is good practice

    if (!user) {
        return res.status(404).json({
        success: false,
        message: 'User not found'
        });
    }

    // 2. Add activity log (fire and forget, or await)
    // Since logActivity returns a Promise, we should await it or use .catch
    // For non-critical background tasks, a fire-and-forget promise with a catch is fine.
    if (user.logActivity) {
        user.logActivity(
        'display_name_updated',
        `Display name updated to "${trimmedName}"`,
        {
            resourceType: 'user',
            resourceId: userId,
            metadata: {
            updatedBy: req.user?._id?.toString() || 'system',
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
            },
            ipAddress: req.ip, // Passing ipAddress and userAgent directly is better as per your logActivity method
            userAgent: req.get('user-agent')
        }
        ).catch(console.error);
        
        // Note: logActivity also calls user.save(), so you don't need another save here.
    }

    // 3. Send the actual document (user) in the response
    res.status(200).json({
        success: true,
        data: user, // 'user' is now the Mongoose document, which is safely convertible to JSON
        message: 'Display name updated successfully'
    });
  } catch (error) {
    console.error('Error updating display name:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating display name'
    });
  }
};