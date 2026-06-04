import { UserModel } from '../../models/user/index.js';
import { UpdatePublicIdentityDto } from '../../application/dto/update-public-identity.dto.js';
import { UpdatePublicIdentityUseCase } from '../../application/use-cases/update-public-identity.use-case.js';
import { MongoosePublicIdentityGateway } from '../../infrastructure/gateways/mongoose-public-identity.gateway.js';

const isUserProfileDddEnabled = () => process.env.USER_PROFILE_DDD_ENABLED !== 'false';
const publicIdentityGateway = new MongoosePublicIdentityGateway();
const updatePublicIdentityUseCase = new UpdatePublicIdentityUseCase({ publicIdentityGateway });

const normalizeString = (value, maxLength = null) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return '';
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return '';
  }

  return maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

export const UpdatePublicIdentity = async (req, res) => {
  if (isUserProfileDddEnabled()) {
    try {
      const response = await updatePublicIdentityUseCase.execute(
        UpdatePublicIdentityDto.fromRequest({
          userId: req.userId || null,
          body: req.body || {},
        }),
      );

      return res.status(response.statusCode).json(response.body);
    } catch (error) {
      console.error('Error updating public identity:', error);

      if (error?.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Username is already in use by another user.',
        });
      }

      if (error?.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Internal server error. Please try again later.',
      });
    }
  }

  try {
    const targetUserId = req.userId;
    const {
      username,
      website,
      instagram,
      tiktok,
      facebook,
      x,
      youtube,
      linkedin,
    } = req.body;

    if (!targetUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const updateFields = {};

    if (username !== undefined) {
      const normalizedUsername = normalizeString(username, 30);
      const usernameRegex = /^[a-zA-Z0-9_]+$/;

      if (!normalizedUsername) {
        return res.status(400).json({
          success: false,
          message: 'Username is required.',
        });
      }

      if (!usernameRegex.test(normalizedUsername)) {
        return res.status(400).json({
          success: false,
          message: 'Username can only contain letters, numbers, and underscores.',
        });
      }

      const existingUser = await UserModel.findOne({
        username: normalizedUsername,
        _id: { $ne: targetUserId },
      }).lean();

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Username is already in use by another user.',
        });
      }

      updateFields.username = normalizedUsername;
      updateFields['referralInfo.referralCode'] = normalizedUsername;
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
      return res.status(400).json({
        success: false,
        message: 'No public identity fields were provided.',
      });
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      targetUserId,
      { $set: updateFields },
      { new: true, runValidators: true, context: 'query' },
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (typeof updatedUser.logActivity === 'function') {
      await updatedUser.logActivity(
        'profile_update',
        'You updated your public identity and linked social profiles',
        {
          updatedFields: Object.keys(updateFields),
        },
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Public identity updated successfully.',
    });
  } catch (error) {
    console.error('Error updating public identity:', error);

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Username is already in use by another user.',
      });
    }

    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.',
    });
  }
};
