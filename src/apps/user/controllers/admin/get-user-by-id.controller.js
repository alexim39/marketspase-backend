import { UserModel } from '../../models/user.model.js';
import mongoose from 'mongoose';


// Controller to get a single user by ID
export const getAppUserById = async (req, res) => {
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

    // Find a single user by their ID
    // .findById() is a convenient Mongoose method for this
    // We still use .select('-password') for security
    const user = await UserModel.findById(id)
    .populate('testimonials')
    .select('-password').exec();

    // If no user is found with the given ID, return a 404 Not Found error
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Send a success response with the single user's data
    res.status(200).json({
      success: true,
      message: 'User fetched successfully',
      data: user
    });
  } catch (error) {
    // Handle errors, such as invalid ID format (e.g., non-valid ObjectId)
    console.error('Error fetching user by ID:', error);
    // Mongoose CastError for invalid IDs
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.'
      });
    }
    // Generic server error
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching the user.'
    });
  }
};