
import { UserModel } from './../models/user.model.js';
import mongoose from 'mongoose';

/**
 * @desc Update a user's profile details
 * @route PATCH /api/users/profile
 * @access Private
 */
export const UpdateProfile = async (req, res) => {
  try {
    const {
      userId,
      email,
      phone,          // may be string, number, with or without country code
      gender,
      street,
      city,
      state,
      country,
      biography,
      dob,
    } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required to update the profile.' });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format.' });
    }

    const existingUser = await UserModel.findById(userId);
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // ---- helpers ----
    const normalizeNgPhone = (raw) => {
      if (raw === undefined || raw === null) return null;
      const s = String(raw).trim();
      if (!s) return null;

      // Remove all non-digits
      let digits = s.replace(/\D/g, '');

      // Handle common cases:
      // Local NG: 11 digits starting with 0 -> drop leading 0, prefix 234
      // E.164 with +234 -> becomes 234... after removing '+'
      // Already 234XXXXXXXXXX -> keep as is
      if (digits.startsWith('0')) {
        // Example: 08031234567 -> 8031234567
        digits = digits.slice(1);
      }
      if (digits.startsWith('234')) {
        // Example: 2348031234567 -> ok
        // Ensure total length is 13 (234 + 10 digits)
        if (digits.length !== 13) return null;
        return digits;
      }

      // If after stripping, we have 10 digits (NG mobile): prefix 234
      if (digits.length === 10) {
        return `234${digits}`;
      }

      // If someone passed 11 digits beginning with non-0 (invalid for NG)
      // or any other length, reject.
      return null;
    };

    const updateData = {};

    // ---- Email (validate + unique) ----
    if (email !== undefined && email !== null) {
      const cleanedEmail = email.toString().trim().toLowerCase();
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (cleanedEmail && !emailRegex.test(cleanedEmail)) {
        return res.status(400).json({ success: false, message: 'Invalid email format.' });
      }
      if (cleanedEmail) {
        const existingUserWithEmail = await UserModel.findOne({
          email: cleanedEmail,
          _id: { $ne: userId },
        });
        if (existingUserWithEmail) {
          return res.status(409).json({
            success: false,
            message: 'This email address is already registered with another account.',
          });
        }
        updateData.email = cleanedEmail;
      } else {
        // allow clearing email to null if desired
        updateData.email = null;
      }
    }

    // ---- Phone (normalize + unique) ----
    if (phone !== undefined) {
      // Allow explicit clearing to null/empty
      const normalizedPhone = normalizeNgPhone(phone);

      if (normalizedPhone === null) {
        // If raw was empty string or invalid -> choose behavior:
        // a) Treat empty as clearing to null; b) reject invalids
        const rawStr = String(phone ?? '').trim();
        if (!rawStr) {
          // Clearing phone to null (allowed with partial unique index)
          updateData['personalInfo.phone'] = null;
        } else {
          return res.status(400).json({
            success: false,
            message: 'Invalid phone number. Use local (e.g., 0803xxxxxxx) or international (e.g., +234803xxxxxxx / 234803xxxxxxx) format.',
          });
        }
      } else {
        // Uniqueness: check only normalized value
        const existingUserWithPhone = await UserModel.findOne({
          'personalInfo.phone': normalizedPhone,
          _id: { $ne: userId },
        }).lean();

        if (existingUserWithPhone) {
          return res.status(409).json({
            success: false,
            message: 'This phone number is already registered with another account.',
          });
        }

        // Single source of truth: set normalized value once
        updateData['personalInfo.phone'] = normalizedPhone;
      }
    }

    // ---- Other personal info ----
    if (biography !== undefined) updateData['personalInfo.biography'] = biography;
    if (gender !== undefined) updateData['personalInfo.gender'] = gender;
    if (dob !== undefined) updateData['personalInfo.dob'] = dob;

    // ---- Address merge ----
    const addressUpdate = {};
    if (street !== undefined) addressUpdate.street = street;
    if (city !== undefined) addressUpdate.city = city;
    if (state !== undefined) addressUpdate.state = state;
    if (country !== undefined) addressUpdate.country = country;

    if (Object.keys(addressUpdate).length > 0) {
      const existingAddress =
        typeof existingUser.personalInfo?.address?.toObject === 'function'
          ? existingUser.personalInfo.address.toObject()
          : existingUser.personalInfo?.address ?? {};
      updateData['personalInfo.address'] = { ...existingAddress, ...addressUpdate };
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields provided for update.' });
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true, context: 'query' }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found after update attempt.' });
    }

    await updatedUser.logActivity('profile_update', `You updated your profile details`, {});

    return res.status(200).json({
      success: true,
      message: 'User profile updated successfully.',
      data: {
        user: {
          id: updatedUser._id,
          email: updatedUser.email,
          personalInfo: updatedUser.personalInfo,
        },
      },
    });
  } catch (error) {
    console.error('Error updating user profile:', error);

    // Database-level duplicate key (index guarantees)
    if (error && error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || '';
      const fieldName = field.replace('personalInfo.', '');
      const fieldMessages = {
        email: 'email address',
        phone: 'phone number',
        username: 'username',
        uid: 'user ID',
      };
      return res.status(409).json({
        success: false,
        message: `This ${fieldMessages[fieldName] ?? fieldName} is already registered.`,
      });
    }

    if (error?.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ success: false, message: `Validation error: ${messages.join(', ')}` });
    }

    if (error?.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid user ID format.' });
    }

    return res.status(500).json({ success: false, message: 'Server error. Failed to update profile.' });
  }
};
