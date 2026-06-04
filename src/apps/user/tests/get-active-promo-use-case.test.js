import test from 'node:test';
import assert from 'node:assert/strict';

import { GetActivePromoDto } from '../application/dto/get-active-promo.dto.js';
import { GetActivePromoUseCase } from '../application/use-cases/get-active-promo.use-case.js';

test('GetActivePromoUseCase preserves empty active promo response', async () => {
  const calls = [];
  const useCase = new GetActivePromoUseCase({
    promoOfferGateway: {
      async findActivePromosForRole(role) {
        calls.push(['findActivePromosForRole', role]);
        return [];
      },
      async getPromoWithSlots() {
        throw new Error('should not load slot details');
      },
    },
  });

  assert.deepEqual(await useCase.execute(GetActivePromoDto.fromRequest()), {
    statusCode: 200,
    body: {
      success: true,
      data: null,
      message: 'No active promotions found',
    },
  });
  assert.deepEqual(calls, [['findActivePromosForRole', 'marketer']]);
});

test('GetActivePromoUseCase returns the first active promo with slot metadata', async () => {
  const calls = [];
  const promoWithSlots = {
    _id: 'promo-1',
    name: 'Launch credit',
    remainingSlots: 12,
    remainingSlotsPercentage: 24,
  };
  const useCase = new GetActivePromoUseCase({
    promoOfferGateway: {
      async findActivePromosForRole(role) {
        calls.push(['findActivePromosForRole', role]);
        return [
          { _id: 'promo-1' },
          { _id: 'promo-2' },
        ];
      },
      async getPromoWithSlots(promoId) {
        calls.push(['getPromoWithSlots', promoId]);
        return promoWithSlots;
      },
    },
  });

  assert.deepEqual(await useCase.execute(new GetActivePromoDto({
    role: 'marketer',
  })), {
    statusCode: 200,
    body: {
      success: true,
      data: promoWithSlots,
    },
  });
  assert.deepEqual(calls, [
    ['findActivePromosForRole', 'marketer'],
    ['getPromoWithSlots', 'promo-1'],
  ]);
});

test('GetActivePromoUseCase lets gateway errors propagate to controller failure paths', async () => {
  const useCase = new GetActivePromoUseCase({
    promoOfferGateway: {
      async findActivePromosForRole() {
        throw new Error('active promo lookup failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new GetActivePromoDto()),
    /active promo lookup failed/,
  );
});
