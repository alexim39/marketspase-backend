import test from 'node:test';
import assert from 'node:assert/strict';

import { GetMyPromoClaimsDto } from '../application/dto/get-my-promo-claims.dto.js';
import { GetMyPromoClaimsUseCase } from '../application/use-cases/get-my-promo-claims.use-case.js';

test('GetMyPromoClaimsDto preserves the legacy authenticated user source', () => {
  assert.deepEqual(GetMyPromoClaimsDto.fromRequest({
    user: {
      _id: 'user-1',
    },
  }), new GetMyPromoClaimsDto({
    userId: 'user-1',
  }));
});

test('GetMyPromoClaimsUseCase returns the legacy claims response shape', async () => {
  const calls = [];
  const claims = [
    {
      _id: 'claim-1',
      promoId: {
        name: 'Launch credit',
        code: 'LAUNCH5000',
        creditAmount: 5000,
      },
      status: 'credited',
    },
  ];
  const useCase = new GetMyPromoClaimsUseCase({
    promoOfferGateway: {
      async findPromoClaimsForUser(userId) {
        calls.push(['findPromoClaimsForUser', userId]);
        return claims;
      },
    },
  });

  assert.deepEqual(await useCase.execute(new GetMyPromoClaimsDto({
    userId: 'user-1',
  })), {
    statusCode: 200,
    body: {
      success: true,
      data: claims,
    },
  });
  assert.deepEqual(calls, [['findPromoClaimsForUser', 'user-1']]);
});

test('GetMyPromoClaimsUseCase preserves empty claims response', async () => {
  const useCase = new GetMyPromoClaimsUseCase({
    promoOfferGateway: {
      async findPromoClaimsForUser() {
        return [];
      },
    },
  });

  assert.deepEqual(await useCase.execute({
    userId: 'user-1',
  }), {
    statusCode: 200,
    body: {
      success: true,
      data: [],
    },
  });
});

test('GetMyPromoClaimsUseCase lets gateway errors propagate to controller failure paths', async () => {
  const useCase = new GetMyPromoClaimsUseCase({
    promoOfferGateway: {
      async findPromoClaimsForUser() {
        throw new Error('claims lookup failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new GetMyPromoClaimsDto({
      userId: 'user-1',
    })),
    /claims lookup failed/,
  );
});
