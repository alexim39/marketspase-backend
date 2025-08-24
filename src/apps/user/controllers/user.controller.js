import { UserModel } from './../models/user.model.js';
import mongoose from 'mongoose';

// @desc    Switch user
// @route   POST /api/users/switch-user
// @access  Private
export const SwitchUser = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'userId is required in the request body.'
            });
        }

        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        // Check if the user's current role is either 'promoter' or 'advertiser'
        if (user.role !== 'promoter' && user.role !== 'advertiser') {
            return res.status(400).json({
                success: false,
                message: `User's current role '${user.role}' cannot be switched. Only 'promoter' and 'advertiser' roles are supported for switching.`
            });
        }

        // Determine the new role based on the current role
        const newRole = user.role === 'promoter' ? 'advertiser' : 'promoter';

        // Update the user's role
        user.role = newRole;
        const updatedUser = await user.save();

        // Respond with success
        res.status(200).json({
            success: true,
            //data: updatedUser,
            message: `User role successfully switched to '${newRole}'.`
        });

    } catch (error) {
        console.error('Error switching user role:', error);
        res.status(500).json({ success: false, message: 'Server error. Failed to switch user role.' });
    }
};

/**
 * @desc    Update a user's profile details
 * @route   PATCH /api/users/profile
 * @access  Private
 */
export const UpdateProfile = async (req, res) => {
    try {
        // Extract the userId from the request body.
        // This userId is sent from the frontend to identify which user to update.
        const { userId, email, phone, street, city, state, country, biography, dob } = req.body;

        // Basic validation: Check if a userId is provided.
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'userId is required to update the profile.'
            });
        }

        // Prepare the update object. We handle nested fields here to match the Mongoose schema.
        const updateData = {
            //displayName: displayName,
            email: email,
            // Phone and biography map directly to fields within personalInfo
            'personalInfo.phone': phone,
            'personalInfo.biography': biography,
            'personalInfo.dob': dob,
            // Address fields are nested even deeper
            'personalInfo.address.street': street,
            'personalInfo.address.city': city,
            'personalInfo.address.state': state,
            'personalInfo.address.country': country,
        };

        // Find the user by their ID and update the fields.
        // `findByIdAndUpdate` is a good choice for this as it handles finding and updating in one step.
        // The `new: true` option returns the modified document rather than the original.
        const updatedUser = await UserModel.findByIdAndUpdate(userId, updateData, { new: true, runValidators: true });

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        // Respond with a success message.
        res.status(200).json({
            success: true,
            message: 'User profile updated successfully.',
            // You can optionally return the updated user data.
            // data: updatedUser
        });

    } catch (error) {
        console.error('Error updating user profile:', error);
        // Handle validation errors from Mongoose
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', ')
            });
        }
        res.status(500).json({ success: false, message: 'Server error. Failed to update profile.' });
    }
};

/**
 * @desc    Handle the update of a user's professional information
 * @route   PATCH /api/users/profile
 * @access  Private
 */
export const UpdateProfessionalInfo = async (req, res) => {
  try {
    const { userId, jobTitle, certificate, skills, hobbies } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required.' });
    }

    // --- CORRECTION STARTS HERE ---
    // Since 'education' and 'jobTitle' are now single objects/fields,
    // we can use a single $set operation.
    const updateFields = {};
    
    // Check if fields are provided in the request body before adding them to the update object
    if (jobTitle !== undefined) {
      updateFields['professionalInfo.jobTitle'] = jobTitle;
    }
    
    // Now, professionalInfo.education is a single object, so you use dot notation
    // to set the 'certificate' field inside it.
    if (certificate !== undefined) {
      updateFields['professionalInfo.education.certificate'] = certificate;
    }

    // Skills and hobbies are still arrays, so we can set them directly.
    if (skills !== undefined) {
      updateFields['professionalInfo.skills'] = skills;
    }
    if (hobbies !== undefined) {
      updateFields['interests.hobbies'] = hobbies;
    }
    // --- CORRECTION ENDS HERE ---

    // Check if there's anything to update
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    // Use Mongoose's findByIdAndUpdate to find the user and atomically update the document.
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { $set: updateFields }, // Use a single $set operation
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json({
      message: 'Professional information updated successfully!',
      success: true
    });

  } catch (error) {
    console.error('Error updating professional information:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Internal server error. Please try again later.' });
  }
};

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