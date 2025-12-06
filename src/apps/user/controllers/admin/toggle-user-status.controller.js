import { UserModel } from '../../models/user.model.js';
import mongoose from 'mongoose';

// Controller to toggle the 'isActive' property of a user
export const toggleUserActiveStatus = async (req, res) => {
  try {
    // Extract the user ID from the request parameters
    const { id } = req.params;

    // Check if the ID is provided
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required.'
      });
    }

    // Find the user by ID
    const user = await UserModel.findById(id);

    // If no user is found, return a 404 Not Found error
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Toggle the isActive status
    user.isActive = !user.isActive;

    // Save the updated user document
    await user.save();

    // Send a success response with the updated user data
    res.status(200).json({
      success: true,
      message: `User's active status has been toggled to ${user.isActive}.`,
      data: {
        _id: user._id,
        displayName: user.displayName,
        isActive: user.isActive,
      }
    });
  } catch (error) {
    // Handle errors, such as invalid ID format
    console.error('Error toggling user active status:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.'
      });
    }
    // Generic server error
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating the user status.'
    });
  }
};