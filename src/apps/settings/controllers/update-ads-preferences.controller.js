import { UpdateAdPreferenceDto } from '../application/dto/update-ad-preference.dto.js';
import { UpdateAdPreferenceUseCase } from '../application/use-cases/update-ad-preference.use-case.js';
import {
  SettingsUserNotFoundError,
  SettingsValidationError,
} from '../domain/errors/settings.errors.js';
import { MongooseSettingsUserRepository } from '../infrastructure/repositories/mongoose-settings-user.repository.js';
import { UserModel } from '../../user/models/user/index.js';
import { AD_PREFERENCE_CATEGORIES } from '../../user/models/user/schemas/preferences.schema.js';
import {
  ensureSelfOrAdmin,
  getAuthenticatedUserId,
} from '../../../shared/utils/request-auth.util.js';

const updateAdPreferenceUseCase = new UpdateAdPreferenceUseCase({
  settingsUserRepository: new MongooseSettingsUserRepository(),
});

const ALLOWED_AD_CATEGORIES = new Set(AD_PREFERENCE_CATEGORIES);
const MAX_AD_CATEGORIES = 6;

const normalizeCategoryInput = (categories) => {
  const submittedCategories = Array.isArray(categories) ? categories : [];
  const normalized = [];
  const invalid = [];

  for (const rawCategory of submittedCategories) {
    const category = String(rawCategory || '').trim().toLowerCase();
    if (!category) {
      continue;
    }

    if (!ALLOWED_AD_CATEGORIES.has(category)) {
      invalid.push(category);
      continue;
    }

    if (!normalized.includes(category)) {
      normalized.push(category);
    }
  }

  return { normalized, invalid };
};

export const legacyUpdateAdPreferences = async (req, res) => {
  try {
    const { userId, preferences } = req.body || {};
    const targetUserId = userId || getAuthenticatedUserId(req);

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'A valid preferences payload is required',
      });
    }

    if (!ensureSelfOrAdmin(req, targetUserId, res, 'Not authorized to update these preferences')) {
      return;
    }

    const user = await UserModel.findById(targetUserId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const updateFields = {};
    const hasCategoryToggle = Object.prototype.hasOwnProperty.call(preferences, 'categoryBasedAds');
    const hasLocationToggle = Object.prototype.hasOwnProperty.call(preferences, 'locationBasedAds');
    const hasAdCategories = Object.prototype.hasOwnProperty.call(preferences, 'adCategories');

    if (hasCategoryToggle) {
      updateFields['preferences.categoryBasedAds'] = Boolean(preferences.categoryBasedAds);
    }

    if (hasLocationToggle) {
      updateFields['preferences.locationBasedAds'] = Boolean(preferences.locationBasedAds);
    }

    if (hasAdCategories) {
      if (!Array.isArray(preferences.adCategories)) {
        return res.status(400).json({
          success: false,
          message: 'Ad categories must be provided as an array',
        });
      }

      if (preferences.adCategories.length > MAX_AD_CATEGORIES) {
        return res.status(400).json({
          success: false,
          message: `A maximum of ${MAX_AD_CATEGORIES} ad categories can be selected`,
        });
      }

      const { normalized, invalid } = normalizeCategoryInput(preferences.adCategories);
      if (invalid.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'One or more selected ad categories are invalid',
          invalidCategories: invalid,
        });
      }

      updateFields['preferences.adCategories'] = normalized;
    }

    const resultingCategoryBasedAds = hasCategoryToggle
      ? Boolean(preferences.categoryBasedAds)
      : Boolean(user.preferences?.categoryBasedAds);

    if (!resultingCategoryBasedAds) {
      updateFields['preferences.adCategories'] = [];
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid preference fields to update',
      });
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      targetUserId,
      { $set: updateFields },
      {
        new: true,
        runValidators: true,
      },
    ).select('preferences');

    res.status(200).json({
      success: true,
      message: 'Ad preferences updated successfully',
      data: {
        preferences: updatedUser?.preferences,
      },
    });
  } catch (error) {
    console.error('Error updating ad preferences:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((entry) => entry.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error while updating preferences',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
    });
  }
};

export const UpdateAdPreferences = async (req, res) => {
  if (process.env.SETTINGS_DDD_ENABLED === 'false') {
    return legacyUpdateAdPreferences(req, res);
  }

  try {
    const { userId } = req.body || {};
    const targetUserId = userId || getAuthenticatedUserId(req);

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    if (!ensureSelfOrAdmin(req, targetUserId, res, 'Not authorized to update these preferences')) {
      return;
    }

    const result = await updateAdPreferenceUseCase.execute(
      UpdateAdPreferenceDto.fromRequest({
        body: req.body,
        targetUserId,
      }),
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof SettingsValidationError) {
      return res.status(400).json({
        success: false,
        message: error.message,
        ...(error.details || {}),
      });
    }

    if (error instanceof SettingsUserNotFoundError) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    console.error('Error updating ad preferences:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((entry) => entry.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error while updating preferences',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
    });
  }
};
