import { UserModel } from '../../models/user/index.js';
import mongoose from 'mongoose';




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
