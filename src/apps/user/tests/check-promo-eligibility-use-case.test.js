import test from 'node:test';
import assert from 'node:assert/strict';

import { CheckPromoEligibilityDto } from '../application/dto/check-promo-eligibility.dto.js';
import { CheckPromoEligibilityUseCase } from '../application/use-cases/check-promo-eligibility.use-case.js';

test('CheckPromoEligibilityUseCase preserves promo not found response', async () => {
  const calls = [];
  const useCase = new CheckPromoEligibilityUseCase({
    promoOfferGateway: {
      async findPromoById(promoId) {
        calls.push(['findPromoById', promoId]);
        return null;
      },
      async findUserById() {
        throw new Error('should not load user when promo is missing');
      },
      async checkUserEligibility() {
        throw new Error('should not check eligibility when promo is missing');
      },
    },
  });

  assert.deepEqual(await useCase.execute(CheckPromoEligibilityDto.fromRequest({
    params: {
      promoId: 'promo-1',
      userId: 'user-1',
    },
  })), {
    statusCode: 404,
    body: {
      success: false,
      message: 'Promotional offer not found',
    },
  });
  assert.deepEqual(calls, [['findPromoById', 'promo-1']]);
});

test('CheckPromoEligibilityUseCase preserves user not found response', async () => {
  const calls = [];
  const promo = { _id: 'promo-1' };
  const useCase = new CheckPromoEligibilityUseCase({
    promoOfferGateway: {
      async findPromoById(promoId) {
        calls.push(['findPromoById', promoId]);
        return promo;
      },
      async findUserById(userId) {
        calls.push(['findUserById', userId]);
        return null;
      },
      async checkUserEligibility() {
        throw new Error('should not check eligibility when user is missing');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new CheckPromoEligibilityDto({
    promoId: 'promo-1',
    userId: 'user-1',
  })), {
    statusCode: 404,
    body: {
      success: false,
      message: 'User not found',
    },
  });
  assert.deepEqual(calls, [
    ['findPromoById', 'promo-1'],
    ['findUserById', 'user-1'],
  ]);
});

test('CheckPromoEligibilityUseCase returns promo model eligibility result', async () => {
  const calls = [];
  const promo = { _id: 'promo-1' };
  const user = { _id: 'user-1' };
  const eligibility = {
    eligible: true,
    reason: null,
    remainingSlots: 10,
  };
  const useCase = new CheckPromoEligibilityUseCase({
    promoOfferGateway: {
      async findPromoById(promoId) {
        calls.push(['findPromoById', promoId]);
        return promo;
      },
      async findUserById(userId) {
        calls.push(['findUserById', userId]);
        return user;
      },
      async checkUserEligibility(command) {
        calls.push(['checkUserEligibility', command]);
        return eligibility;
      },
    },
  });

  assert.deepEqual(await useCase.execute({
    promoId: 'promo-1',
    userId: 'user-1',
  }), {
    statusCode: 200,
    body: {
      success: true,
      data: eligibility,
    },
  });
  assert.deepEqual(calls, [
    ['findPromoById', 'promo-1'],
    ['findUserById', 'user-1'],
    ['checkUserEligibility', { promo, user }],
  ]);
});

test('CheckPromoEligibilityUseCase lets gateway errors propagate to controller failure paths', async () => {
  const useCase = new CheckPromoEligibilityUseCase({
    promoOfferGateway: {
      async findPromoById() {
        throw new Error('promo lookup failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new CheckPromoEligibilityDto({
      promoId: 'promo-1',
      userId: 'user-1',
    })),
    /promo lookup failed/,
  );
});
