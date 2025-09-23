import { UserModel } from './../models/user.model.js';
import mongoose from 'mongoose';

/**
 * @desc    Update a user's profile details
 * @route   PATCH /api/users/profile
 * @access  Private
 */
export const UpdateProfile = async (req, res) => {
    try {
        // Extract the userId from the request body or authenticated user
        const { userId, email, phone, street, city, state, country, biography, dob } = req.body;

        // Basic validation: Check if a userId is provided
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required to update the profile.'
            });
        }

        // Validate MongoDB ObjectId format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID format.'
            });
        }

        // Check if user exists
        const existingUser = await UserModel.findById(userId);
        if (!existingUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        // Email validation and uniqueness check
        if (email !== undefined && email !== null) {
            const cleanedEmail = email.toString().trim().toLowerCase();
            
            // Validate email format
            const emailRegex = /^\S+@\S+\.\S+$/;
            if (cleanedEmail && !emailRegex.test(cleanedEmail)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email format.'
                });
            }

            // Check for duplicate email (only if email is not empty/null)
            if (cleanedEmail) {
                const existingUserWithEmail = await UserModel.findOne({
                    email: cleanedEmail,
                    _id: { $ne: userId } // Exclude current user from the check
                });

                if (existingUserWithEmail) {
                    return res.status(409).json({
                        success: false,
                        message: 'This email address is already registered with another account.'
                    });
                }
            }
            
            // Allow setting email to null/empty if needed, but validate format when provided
        }

        // Phone number validation and uniqueness check
        if (phone !== undefined && phone !== null) {
            const cleanedPhone = phone.toString().trim();
            
            // Basic phone validation (adjust regex as needed for your region)
            const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
            if (cleanedPhone && !phoneRegex.test(cleanedPhone)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid phone number format. Please provide a valid phone number.'
                });
            }

            // Check for duplicate phone number only if phone is not empty
            if (cleanedPhone) {
                const existingUserWithPhone = await UserModel.findOne({
                    'personalInfo.phone': cleanedPhone,
                    _id: { $ne: userId } // Exclude current user from the check
                });

                if (existingUserWithPhone) {
                    return res.status(409).json({
                        success: false,
                        message: 'This phone number is already registered with another account.'
                    });
                }
            }
        }

        // Prepare the update object with only provided fields
        const updateData = {};
        
        // Only add fields to updateData if they are provided
        if (email !== undefined) {
            updateData.email = email.toString().trim().toLowerCase() || null;
        }
        
        if (phone !== undefined) {
            updateData['personalInfo.phone'] = phone.toString().trim() || null;
        }
        
        if (biography !== undefined) updateData['personalInfo.biography'] = biography;
        if (dob !== undefined) updateData['personalInfo.dob'] = dob;
        
        // Address fields
        const addressUpdate = {};
        if (street !== undefined) addressUpdate.street = street;
        if (city !== undefined) addressUpdate.city = city;
        if (state !== undefined) addressUpdate.state = state;
        if (country !== undefined) addressUpdate.country = country;
        
        // Only add address to update if at least one address field is provided
        if (Object.keys(addressUpdate).length > 0) {
            updateData['personalInfo.address'] = {
                ...existingUser.personalInfo.address?.toObject?.() || {},
                ...addressUpdate
            };
        }

        // Check if there's actually data to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields provided for update.'
            });
        }

        // Perform the update with proper error handling
        const updatedUser = await UserModel.findByIdAndUpdate(
            userId, 
            updateData, 
            { 
                new: true, 
                runValidators: true,
                context: 'query' // Ensures validators run with the update operation
            }
        ).select('-password'); // Exclude password from the returned user data

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found after update attempt.'
            });
        }

        // Respond with success
        res.status(200).json({
            success: true,
            message: 'User profile updated successfully.',
            data: {
                user: {
                    id: updatedUser._id,
                    email: updatedUser.email,
                    personalInfo: updatedUser.personalInfo
                }
            }
        });

    } catch (error) {
        console.error('Error updating user profile:', error);
        
        // Handle specific MongoDB duplicate key errors
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            let fieldName = field.replace('personalInfo.', '');
            
            // Map field names to user-friendly messages
            const fieldMessages = {
                'email': 'email address',
                'phone': 'phone number',
                'username': 'username',
                'uid': 'user ID'
            };
            
            return res.status(409).json({
                success: false,
                message: `This ${fieldMessages[fieldName] || fieldName} is already registered.`
            });
        }
        
        // Handle validation errors from Mongoose
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                message: `Validation error: ${messages.join(', ')}`
            });
        }
        
        // Handle CastError (invalid ObjectId)
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID format.'
            });
        }

        // Generic server error
        res.status(500).json({ 
            success: false, 
            message: 'Server error. Failed to update profile.' 
        });
    }
};