import test from 'node:test';
import assert from 'node:assert/strict';

import { UpdateProfessionalProfileDto } from '../application/dto/update-professional-profile.dto.js';
import { UpdateProfessionalProfileUseCase } from '../application/use-cases/update-professional-profile.use-case.js';

test('UpdateProfessionalProfileUseCase preserves missing and invalid user ID responses', async () => {
  const useCase = new UpdateProfessionalProfileUseCase({
    professionalProfileGateway: {
      isValidObjectId() {
        return false;
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdateProfessionalProfileDto({
    body: { jobTitle: 'Founder' },
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'User ID is required.',
    },
  });

  assert.deepEqual(await useCase.execute(new UpdateProfessionalProfileDto({
    userId: 'not-valid',
    body: { jobTitle: 'Founder' },
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Invalid user ID.',
    },
  });
});

test('UpdateProfessionalProfileUseCase preserves no fields response', async () => {
  const useCase = new UpdateProfessionalProfileUseCase({
    professionalProfileGateway: {
      isValidObjectId() {
        return true;
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdateProfessionalProfileDto({
    userId: '507f1f77bcf86cd799439011',
    body: {},
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'No fields to update.',
    },
  });
});

test('UpdateProfessionalProfileUseCase normalizes and updates professional fields', async () => {
  const calls = [];
  const updatedUser = { _id: 'user-1' };
  const useCase = new UpdateProfessionalProfileUseCase({
    professionalProfileGateway: {
      isValidObjectId(value) {
        calls.push(['valid', value]);
        return true;
      },
      async updateProfessionalProfile(command) {
        calls.push(['update', command]);
        return updatedUser;
      },
      async logProfessionalProfileUpdate(command) {
        calls.push(['log', command]);
      },
    },
  });

  const result = await useCase.execute(UpdateProfessionalProfileDto.fromRequest({
    userId: '507f1f77bcf86cd799439011',
    body: {
      jobTitle: ' Founder ',
      certificate: null,
      skills: [' Ads ', 'Ads', 'Growth', ''],
      hobbies: 'not-an-array',
      profileHeadline: '  Helping stores grow ',
      brandName: ' MarketSpase ',
      brandSummary: '  Simple growth tools ',
      uniqueSellingPoints: ['Fast setup', '  Campaign analytics  ', 'Fast setup'],
      website: null,
      instagram: ' @marketspase ',
    },
  }));

  assert.deepEqual(calls, [
    ['valid', '507f1f77bcf86cd799439011'],
    ['update', {
      userId: '507f1f77bcf86cd799439011',
      updateFields: {
        'professionalInfo.jobTitle': 'Founder',
        'professionalInfo.education.certificate': null,
        'professionalInfo.profileHeadline': 'Helping stores grow',
        'professionalInfo.businessProfile.brandName': 'MarketSpase',
        'professionalInfo.businessProfile.brandSummary': 'Simple growth tools',
        'professionalInfo.skills': ['Ads', 'Growth'],
        'interests.hobbies': [],
        'professionalInfo.businessProfile.uniqueSellingPoints': ['Fast setup', 'Campaign analytics'],
        'professionalInfo.socialProfiles.website': null,
        'professionalInfo.socialProfiles.instagram': '@marketspase',
      },
    }],
    ['log', {
      user: updatedUser,
      updatedFields: [
        'professionalInfo.jobTitle',
        'professionalInfo.education.certificate',
        'professionalInfo.profileHeadline',
        'professionalInfo.businessProfile.brandName',
        'professionalInfo.businessProfile.brandSummary',
        'professionalInfo.skills',
        'interests.hobbies',
        'professionalInfo.businessProfile.uniqueSellingPoints',
        'professionalInfo.socialProfiles.website',
        'professionalInfo.socialProfiles.instagram',
      ],
    }],
  ]);
  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      message: 'Professional information updated successfully!',
      success: true,
    },
  });
});

test('UpdateProfessionalProfileUseCase preserves missing user response', async () => {
  const useCase = new UpdateProfessionalProfileUseCase({
    professionalProfileGateway: {
      isValidObjectId() {
        return true;
      },
      async updateProfessionalProfile() {
        return null;
      },
      async logProfessionalProfileUpdate() {
        throw new Error('should not log missing user');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdateProfessionalProfileDto({
    userId: '507f1f77bcf86cd799439011',
    body: { jobTitle: 'Founder' },
  })), {
    statusCode: 404,
    body: {
      success: false,
      message: 'User not found.',
    },
  });
});

test('UpdateProfessionalProfileUseCase lets gateway errors propagate to controller failure paths', async () => {
  const useCase = new UpdateProfessionalProfileUseCase({
    professionalProfileGateway: {
      isValidObjectId() {
        return true;
      },
      async updateProfessionalProfile() {
        throw new Error('professional update failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new UpdateProfessionalProfileDto({
      userId: '507f1f77bcf86cd799439011',
      body: { jobTitle: 'Founder' },
    })),
    /professional update failed/,
  );
});
