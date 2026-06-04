import { AD_PREFERENCE_CATEGORIES } from "../../../user/models/user/schemas/preferences.schema.js";
import {
  SettingsUserNotFoundError,
  SettingsValidationError,
} from "../../domain/errors/settings.errors.js";
import { UpdateAdPreferenceDto } from "../dto/update-ad-preference.dto.js";

const ALLOWED_AD_CATEGORIES = new Set(AD_PREFERENCE_CATEGORIES);
const MAX_AD_CATEGORIES = 6;

const normalizeCategoryInput = (categories) => {
  const submittedCategories = Array.isArray(categories) ? categories : [];
  const normalized = [];
  const invalid = [];

  for (const rawCategory of submittedCategories) {
    const category = String(rawCategory || "").trim().toLowerCase();

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

export class UpdateAdPreferenceUseCase {
  constructor({ settingsUserRepository }) {
    this.settingsUserRepository = settingsUserRepository;
  }

  async execute(input) {
    const dto = input instanceof UpdateAdPreferenceDto
      ? input
      : new UpdateAdPreferenceDto(input);

    if (!dto.userId) {
      throw new SettingsValidationError("User ID is required");
    }

    if (!dto.preferences || typeof dto.preferences !== "object") {
      throw new SettingsValidationError("A valid preferences payload is required");
    }

    const currentPreferences = await this.settingsUserRepository.findPreferencesByUserId(dto.userId);

    if (!currentPreferences) {
      throw new SettingsUserNotFoundError();
    }

    const updateFields = {};
    const hasCategoryToggle = Object.prototype.hasOwnProperty.call(dto.preferences, "categoryBasedAds");
    const hasLocationToggle = Object.prototype.hasOwnProperty.call(dto.preferences, "locationBasedAds");
    const hasAdCategories = Object.prototype.hasOwnProperty.call(dto.preferences, "adCategories");

    if (hasCategoryToggle) {
      updateFields["preferences.categoryBasedAds"] = Boolean(dto.preferences.categoryBasedAds);
    }

    if (hasLocationToggle) {
      updateFields["preferences.locationBasedAds"] = Boolean(dto.preferences.locationBasedAds);
    }

    if (hasAdCategories) {
      if (!Array.isArray(dto.preferences.adCategories)) {
        throw new SettingsValidationError("Ad categories must be provided as an array");
      }

      if (dto.preferences.adCategories.length > MAX_AD_CATEGORIES) {
        throw new SettingsValidationError(`A maximum of ${MAX_AD_CATEGORIES} ad categories can be selected`);
      }

      const { normalized, invalid } = normalizeCategoryInput(dto.preferences.adCategories);

      if (invalid.length > 0) {
        throw new SettingsValidationError("One or more selected ad categories are invalid", {
          invalidCategories: invalid,
        });
      }

      updateFields["preferences.adCategories"] = normalized;
    }

    const resultingCategoryBasedAds = hasCategoryToggle
      ? Boolean(dto.preferences.categoryBasedAds)
      : Boolean(currentPreferences?.categoryBasedAds);

    if (!resultingCategoryBasedAds) {
      updateFields["preferences.adCategories"] = [];
    }

    if (Object.keys(updateFields).length === 0) {
      throw new SettingsValidationError("No valid preference fields to update");
    }

    const data = await this.settingsUserRepository.updateAdPreference({
      userId: dto.userId,
      updateFields,
    });

    if (!data) {
      throw new SettingsUserNotFoundError();
    }

    return {
      success: true,
      message: "Ad preferences updated successfully",
      data,
    };
  }
}
