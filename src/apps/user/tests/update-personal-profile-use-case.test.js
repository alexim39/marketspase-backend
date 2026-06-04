import test from 'node:test';
import assert from 'node:assert/strict';

import { UpdatePersonalProfileDto } from '../application/dto/update-personal-profile.dto.js';
import { UpdatePersonalProfileUseCase } from '../application/use-cases/update-personal-profile.use-case.js';

const VALID_USER_ID = '507f1f77bcf86cd799439011';

test('UpdatePersonalProfileUseCase preserves missing and invalid user ID responses', async () => {
  const useCase = new UpdatePersonalProfileUseCase({
    personalProfileGateway: {
      isValidObjectId() {
        return false;
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdatePersonalProfileDto({
    body: { email: 'ada@example.com' },
  })), {
    statusCode: 400,
    body: { success: false, message: 'User ID is required to update the profile.' },
  });

  assert.deepEqual(await useCase.execute(new UpdatePersonalProfileDto({
    userId: 'bad-id',
    body: { email: 'ada@example.com' },
  })), {
    statusCode: 400,
    body: { success: false, message: 'Invalid user ID format.' },
  });
});

test('UpdatePersonalProfileUseCase preserves missing user response', async () => {
  const useCase = new UpdatePersonalProfileUseCase({
    personalProfileGateway: {
      isValidObjectId() {
        return true;
      },
      async findUserById() {
        return null;
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdatePersonalProfileDto({
    userId: VALID_USER_ID,
    body: { email: 'ada@example.com' },
  })), {
    statusCode: 404,
    body: { success: false, message: 'User not found.' },
  });
});

test('UpdatePersonalProfileUseCase preserves email validation and duplicate responses', async () => {
  const useCase = new UpdatePersonalProfileUseCase({
    personalProfileGateway: {
      isValidObjectId() {
        return true;
      },
      async findUserById() {
        return { _id: VALID_USER_ID, personalInfo: {} };
      },
      async findUserByEmail({ email }) {
        return email === 'taken@example.com' ? { _id: 'other' } : null;
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdatePersonalProfileDto({
    userId: VALID_USER_ID,
    body: { email: 'bad-email' },
  })), {
    statusCode: 400,
    body: { success: false, message: 'Invalid email format.' },
  });

  assert.deepEqual(await useCase.execute(new UpdatePersonalProfileDto({
    userId: VALID_USER_ID,
    body: { email: 'Taken@Example.com ' },
  })), {
    statusCode: 409,
    body: {
      success: false,
      message: 'This email address is already registered with another account.',
    },
  });
});

test('UpdatePersonalProfileUseCase preserves phone validation and duplicate responses', async () => {
  const useCase = new UpdatePersonalProfileUseCase({
    personalProfileGateway: {
      isValidObjectId() {
        return true;
      },
      async findUserById() {
        return { _id: VALID_USER_ID, personalInfo: {} };
      },
      async findUserByPhone({ phone }) {
        return phone === '2348031234567' ? { _id: 'other' } : null;
      },
    },
  });

  const invalid = await useCase.execute(new UpdatePersonalProfileDto({
    userId: VALID_USER_ID,
    body: { phone: '123', phoneDetails: { countryCode: '234' } },
  }));
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.body.success, false);
  assert.match(invalid.body.message, /Invalid phone number/);

  assert.deepEqual(await useCase.execute(new UpdatePersonalProfileDto({
    userId: VALID_USER_ID,
    body: { phone: '08031234567', phoneDetails: { countryCode: '234', iso2: 'NG' } },
  })), {
    statusCode: 409,
    body: {
      success: false,
      message: 'This phone number is already registered with another account.',
    },
  });
});

test('UpdatePersonalProfileUseCase preserves no valid fields response', async () => {
  const useCase = new UpdatePersonalProfileUseCase({
    personalProfileGateway: {
      isValidObjectId() {
        return true;
      },
      async findUserById() {
        return { _id: VALID_USER_ID, personalInfo: {} };
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdatePersonalProfileDto({
    userId: VALID_USER_ID,
    body: { email: null },
  })), {
    statusCode: 400,
    body: { success: false, message: 'No valid fields provided for update.' },
  });
});

test('UpdatePersonalProfileUseCase updates email, phone, address, and personal fields', async () => {
  const calls = [];
  const lastUpdated = new Date('2026-05-20T12:00:00.000Z');
  const updatedUser = {
    _id: VALID_USER_ID,
    email: 'ada@example.com',
    personalInfo: { biography: 'Builder' },
  };
  const useCase = new UpdatePersonalProfileUseCase({
    now: () => lastUpdated,
    personalProfileGateway: {
      isValidObjectId(value) {
        calls.push(['valid', value]);
        return true;
      },
      async findUserById(userId) {
        calls.push(['find', userId]);
        return {
          _id: userId,
          personalInfo: {
            address: {
              street: 'Old street',
              city: 'Old city',
            },
          },
        };
      },
      async findUserByEmail(query) {
        calls.push(['email', query]);
        return null;
      },
      async findUserByPhone(query) {
        calls.push(['phone', query]);
        return null;
      },
      async updatePersonalProfile(command) {
        calls.push(['update', command]);
        return updatedUser;
      },
      async logPersonalProfileUpdate(command) {
        calls.push(['log', command]);
      },
    },
  });

  const result = await useCase.execute(UpdatePersonalProfileDto.fromRequest({
    userId: VALID_USER_ID,
    body: {
      email: ' Ada@Example.com ',
      phone: '08031234567',
      phoneDetails: { countryCode: '234', iso2: 'NG' },
      gender: 'female',
      biography: 'Builder',
      dob: '1990-01-01',
      city: 'Lagos',
      country: 'Nigeria',
    },
  }));

  assert.deepEqual(calls, [
    ['valid', VALID_USER_ID],
    ['find', VALID_USER_ID],
    ['email', {
      email: 'ada@example.com',
      excludedUserId: VALID_USER_ID,
    }],
    ['phone', {
      phone: '2348031234567',
      excludedUserId: VALID_USER_ID,
    }],
    ['update', {
      userId: VALID_USER_ID,
      updateData: {
        email: 'ada@example.com',
        'personalInfo.phone': '2348031234567',
        'personalInfo.phoneDetails': {
          countryCode: '234',
          nationalNumber: '8031234567',
          fullNumber: '+2348031234567',
          iso2: 'NG',
          lastUpdated,
        },
        'personalInfo.biography': 'Builder',
        'personalInfo.gender': 'female',
        'personalInfo.dob': '1990-01-01',
        'personalInfo.address': {
          street: 'Old street',
          city: 'Lagos',
          country: 'Nigeria',
        },
      },
    }],
    ['log', { user: updatedUser }],
  ]);
  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      message: 'User profile updated successfully.',
      data: {
        user: {
          id: VALID_USER_ID,
          email: 'ada@example.com',
          personalInfo: { biography: 'Builder' },
        },
      },
    },
  });
});

test('UpdatePersonalProfileUseCase preserves missing updated user response', async () => {
  const useCase = new UpdatePersonalProfileUseCase({
    personalProfileGateway: {
      isValidObjectId() {
        return true;
      },
      async findUserById() {
        return { _id: VALID_USER_ID, personalInfo: {} };
      },
      async updatePersonalProfile() {
        return null;
      },
      async logPersonalProfileUpdate() {
        throw new Error('should not log missing update');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new UpdatePersonalProfileDto({
    userId: VALID_USER_ID,
    body: { biography: 'Builder' },
  })), {
    statusCode: 404,
    body: { success: false, message: 'User not found after update attempt.' },
  });
});

test('UpdatePersonalProfileUseCase lets gateway errors propagate to controller failure paths', async () => {
  const useCase = new UpdatePersonalProfileUseCase({
    personalProfileGateway: {
      isValidObjectId() {
        return true;
      },
      async findUserById() {
        throw new Error('personal profile lookup failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new UpdatePersonalProfileDto({
      userId: VALID_USER_ID,
      body: { biography: 'Builder' },
    })),
    /personal profile lookup failed/,
  );
});
