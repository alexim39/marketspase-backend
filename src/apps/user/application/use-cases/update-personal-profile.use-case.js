import {
  buildCanonicalPhoneDetails,
  buildClearedPhoneDetails,
  norm,
  normalizePhoneWithoutLib,
} from '../../domain/services/personal-profile-normalizer.js';
import { UpdatePersonalProfileDto } from '../dto/update-personal-profile.dto.js';

const INVALID_PHONE_MESSAGE =
  'Invalid phone number. Use a valid local number with its country (e.g., 0803â€¦ + NG) or an international number (e.g., +234803â€¦, +1415â€¦, +4479â€¦).';

export class UpdatePersonalProfileUseCase {
  constructor({ personalProfileGateway, now = () => new Date() } = {}) {
    if (!personalProfileGateway) {
      throw new Error('personalProfileGateway is required');
    }

    this.personalProfileGateway = personalProfileGateway;
    this.now = now;
  }

  async execute(input) {
    const dto = input instanceof UpdatePersonalProfileDto ? input : new UpdatePersonalProfileDto(input);
    const payload = dto.body;

    if (!dto.userId) {
      return {
        statusCode: 400,
        body: { success: false, message: 'User ID is required to update the profile.' },
      };
    }

    if (!this.personalProfileGateway.isValidObjectId(dto.userId)) {
      return {
        statusCode: 400,
        body: { success: false, message: 'Invalid user ID format.' },
      };
    }

    const existingUser = await this.personalProfileGateway.findUserById(dto.userId);
    if (!existingUser) {
      return {
        statusCode: 404,
        body: { success: false, message: 'User not found.' },
      };
    }

    const updateData = {};

    if (payload.email !== undefined && payload.email !== null) {
      const cleanedEmail = norm(payload.email).toLowerCase();
      const emailRegex = /^\S+@\S+\.\S+$/;

      if (cleanedEmail && !emailRegex.test(cleanedEmail)) {
        return {
          statusCode: 400,
          body: { success: false, message: 'Invalid email format.' },
        };
      }

      if (cleanedEmail) {
        const existingUserWithEmail = await this.personalProfileGateway.findUserByEmail({
          email: cleanedEmail,
          excludedUserId: dto.userId,
        });

        if (existingUserWithEmail) {
          return {
            statusCode: 409,
            body: {
              success: false,
              message: 'This email address is already registered with another account.',
            },
          };
        }

        updateData.email = cleanedEmail;
      } else {
        updateData.email = null;
      }
    }

    if (payload.phone !== undefined) {
      const rawStr = norm(payload.phone);
      const lastUpdated = this.now();

      if (!rawStr) {
        updateData['personalInfo.phone'] = null;
        updateData['personalInfo.phoneDetails'] = buildClearedPhoneDetails(lastUpdated);
      } else {
        let canonical;
        try {
          canonical = normalizePhoneWithoutLib(rawStr, payload.phoneDetails, payload.country);
        } catch (error) {
          if (error?.message === 'INVALID_PHONE') {
            return {
              statusCode: 400,
              body: {
                success: false,
                message: INVALID_PHONE_MESSAGE,
              },
            };
          }

          throw error;
        }

        const existingUserWithPhone = await this.personalProfileGateway.findUserByPhone({
          phone: canonical.digits,
          excludedUserId: dto.userId,
        });

        if (existingUserWithPhone) {
          return {
            statusCode: 409,
            body: {
              success: false,
              message: 'This phone number is already registered with another account.',
            },
          };
        }

        updateData['personalInfo.phone'] = canonical.digits;
        updateData['personalInfo.phoneDetails'] = buildCanonicalPhoneDetails(canonical, lastUpdated);
      }
    }

    if (payload.biography !== undefined) updateData['personalInfo.biography'] = payload.biography;
    if (payload.gender !== undefined) updateData['personalInfo.gender'] = payload.gender;
    if (payload.dob !== undefined) updateData['personalInfo.dob'] = payload.dob;

    const addressUpdate = {};
    if (payload.street !== undefined) addressUpdate.street = payload.street;
    if (payload.city !== undefined) addressUpdate.city = payload.city;
    if (payload.state !== undefined) addressUpdate.state = payload.state;
    if (payload.country !== undefined) addressUpdate.country = payload.country;
    if (Object.keys(addressUpdate).length > 0) {
      const existingAddress = existingUser?.personalInfo?.address ?? {};
      updateData['personalInfo.address'] = { ...existingAddress, ...addressUpdate };
    }

    if (Object.keys(updateData).length === 0) {
      return {
        statusCode: 400,
        body: { success: false, message: 'No valid fields provided for update.' },
      };
    }

    const updatedUser = await this.personalProfileGateway.updatePersonalProfile({
      userId: dto.userId,
      updateData,
    });

    if (!updatedUser) {
      return {
        statusCode: 404,
        body: { success: false, message: 'User not found after update attempt.' },
      };
    }

    await this.personalProfileGateway.logPersonalProfileUpdate({ user: updatedUser });

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'User profile updated successfully.',
        data: {
          user: {
            id: updatedUser._id,
            email: updatedUser.email,
            personalInfo: updatedUser.personalInfo,
          },
        },
      },
    };
  }
}
