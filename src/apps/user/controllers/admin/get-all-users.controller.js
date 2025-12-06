import { UserModel } from '../../models/user.model.js';
import mongoose from 'mongoose';


// Controller to get all users
export const getAppUsers = async (req, res) => {
  try {
    // Find all users in the database
    // The .select('-password') is crucial for security, it excludes the password field from the result.
    const users = await UserModel.find({})
      .select('-password')
      .sort({ createdAt: -1 })
      .exec();

    // Send a success response with the users data
    res.status(200).json({
      success: true,
      message: 'Users fetched successfully',
      data: users
    });
  } catch (error) {
    // Handle any errors that occur during the database query
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching users.'
    });
  }
};