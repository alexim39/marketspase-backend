import mongoose from 'mongoose';
import { UserModel } from '../../models/user/index.js';

const normalizeString = (value, maxLength = null) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return '';
  }

  return maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

const normalizeStringArray = (value, maxItems = 10, maxLength = 160) => {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(
    value
      .map((item) => normalizeString(item, maxLength))
      .filter(Boolean)
  )).slice(0, maxItems);
};

/**
 * @desc    Handle the update of a user's professional information
 * @route   PUT /user/profile/profession
 * @access  Private
 */
export const UpdateProfessionalInfo = async (req, res) => {
  try {
    const targetUserId = req.userId;

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'User ID is required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    const {
      jobTitle,
      certificate,
      skills,
      hobbies,
      profileHeadline,
      brandName,
      brandSummary,
      uniqueSellingPoints,
      website,
      instagram,
      tiktok,
      facebook,
      x,
      youtube,
      linkedin,
    } = req.body;

    const updateFields = {};

    if (jobTitle !== undefined) {
      updateFields['professionalInfo.jobTitle'] = normalizeString(jobTitle, 80);
    }

    if (certificate !== undefined) {
      updateFields['professionalInfo.education.certificate'] = normalizeString(certificate, 160);
    }

    if (skills !== undefined) {
      updateFields['professionalInfo.skills'] = normalizeStringArray(skills, 20, 80);
    }

    if (hobbies !== undefined) {
      updateFields['interests.hobbies'] = normalizeStringArray(hobbies, 20, 80);
    }

    if (profileHeadline !== undefined) {
      updateFields['professionalInfo.profileHeadline'] = normalizeString(profileHeadline, 160);
    }

    if (brandName !== undefined) {
      updateFields['professionalInfo.businessProfile.brandName'] = normalizeString(brandName, 120);
    }

    if (brandSummary !== undefined) {
      updateFields['professionalInfo.businessProfile.brandSummary'] = normalizeString(brandSummary, 1000);
    }

    if (uniqueSellingPoints !== undefined) {
      updateFields['professionalInfo.businessProfile.uniqueSellingPoints'] = normalizeStringArray(uniqueSellingPoints, 8, 160);
    }

    const socialFieldMap = {
      website: 'professionalInfo.socialProfiles.website',
      instagram: 'professionalInfo.socialProfiles.instagram',
      tiktok: 'professionalInfo.socialProfiles.tiktok',
      facebook: 'professionalInfo.socialProfiles.facebook',
      x: 'professionalInfo.socialProfiles.x',
      youtube: 'professionalInfo.socialProfiles.youtube',
      linkedin: 'professionalInfo.socialProfiles.linkedin',
    };

    for (const [incomingField, targetField] of Object.entries(socialFieldMap)) {
      if (req.body[incomingField] !== undefined) {
        updateFields[targetField] = normalizeString(req.body[incomingField], 300);
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      targetUserId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (typeof updatedUser.logActivity === 'function') {
      await updatedUser.logActivity(
        'profile_professional_update',
        'You updated your public profile and professional information',
        {
          updatedFields: Object.keys(updateFields),
        }
      );
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
