import { UserModel } from '../../models/user/index.js';
import mongoose from 'mongoose';


/**
 * @desc    Handle the update of a user's username information
 * @route   PATCH /api/users/username
 * @access  Private (Authentication Middleware should be applied before this)
 */
export const UpdateUsername = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, username } = req.body;

    // 1. Validate required fields
    if (!username || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Username and user ID are required.',
      });
    }

    // 2. Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        success: false,
        message: 'Username can only contain letters, numbers, and underscores.',
      });
    }

    // 3. Find the user to update by their ID
    const user = await UserModel.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // 4. Check for username uniqueness
    // We check if another user (not the current user) already has this username
    const existingUser = await UserModel.findOne({ username }).session(session);

    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        success: false,
        message: 'Username is already in use by another user.',
      });
    }

    // 5. Update the username and save
    user.username = username;
    await user.save({ session });

    // 6. Commit transaction and end session
    await session.commitTransaction();
    session.endSession();

    // log this activity
    await user.logActivity('profile_update', `You updated your profile username to ${username}`, {});

    // 7. Send success response
    res.status(200).json({
      success: true,
      message: 'Username updated successfully!',
    });
  } catch (error) {
    console.error('Error during username update:', error);
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      success: false,
      message: 'An internal server error occurred. Please try again later.',
    });
  }
};
