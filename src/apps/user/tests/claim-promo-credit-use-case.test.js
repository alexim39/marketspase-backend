import test from 'node:test';
import assert from 'node:assert/strict';

import { ClaimPromoCreditDto } from '../application/dto/claim-promo-credit.dto.js';
import { ClaimPromoCreditUseCase } from '../application/use-cases/claim-promo-credit.use-case.js';

test('ClaimPromoCreditUseCase preserves missing promo ID response before repository access', async () => {
  const useCase = new ClaimPromoCreditUseCase({
    promoOfferGateway: {
      async findPromoById() {
        throw new Error('should not query without promo ID');
      },
    },
  });

  assert.deepEqual(await useCase.execute(ClaimPromoCreditDto.fromRequest({
    body: {
      userId: 'user-1',
    },
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Promo ID is required',
    },
  });
});

test('ClaimPromoCreditUseCase preserves promo not found response', async () => {
  const calls = [];
  const useCase = new ClaimPromoCreditUseCase({
    promoOfferGateway: {
      async findPromoById(promoId) {
        calls.push(['findPromoById', promoId]);
        return null;
      },
      async findUserById() {
        throw new Error('should not load user when promo is missing');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new ClaimPromoCreditDto({
    promoId: 'promo-1',
    userId: 'user-1',
  })), {
    statusCode: 404,
    body: {
      success: false,
      message: 'Promotional offer not found',
    },
  });
  assert.deepEqual(calls, [['findPromoById', 'promo-1']]);
});

test('ClaimPromoCreditUseCase preserves user not found response', async () => {
  const promo = { _id: 'promo-1' };
  const calls = [];
  const useCase = new ClaimPromoCreditUseCase({
    promoOfferGateway: {
      async findPromoById(promoId) {
        calls.push(['findPromoById', promoId]);
        return promo;
      },
      async findUserById(userId) {
        calls.push(['findUserById', userId]);
        return null;
      },
    },
  });

  assert.deepEqual(await useCase.execute({
    promoId: 'promo-1',
    userId: 'user-1',
  }), {
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

test('ClaimPromoCreditUseCase preserves ineligible promo response', async () => {
  const promo = { _id: 'promo-1' };
  const user = { _id: 'user-1' };
  const useCase = new ClaimPromoCreditUseCase({
    promoOfferGateway: {
      async findPromoById() {
        return promo;
      },
      async findUserById() {
        return user;
      },
      async checkUserEligibility() {
        return {
          eligible: false,
          reason: 'Minimum rating requirement not met',
        };
      },
      async createPromoClaim() {
        throw new Error('should not create claim for ineligible user');
      },
    },
  });

  assert.deepEqual(await useCase.execute({
    promoId: 'promo-1',
    userId: 'user-1',
  }), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Minimum rating requirement not met',
    },
  });
});

test('ClaimPromoCreditUseCase creates a non-auto-credit claim with the legacy response shape', async () => {
  const calls = [];
  const promo = {
    _id: 'promo-1',
    creditAmount: 5000,
    autoCredit: false,
  };
  const user = {
    _id: 'user-1',
    role: 'marketer',
  };
  const promoClaim = {
    _id: 'claim-1',
    status: 'claimed',
  };
  const useCase = new ClaimPromoCreditUseCase({
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
        return { eligible: true };
      },
      async createPromoClaim(command) {
        calls.push(['createPromoClaim', command]);
        return promoClaim;
      },
      async incrementClaimedSlots(promoId) {
        calls.push(['incrementClaimedSlots', promoId]);
      },
      async creditUserWallet() {
        throw new Error('should not credit wallet when autoCredit is false');
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
      message: 'Promotional credit claimed successfully',
      data: {
        claimId: 'claim-1',
        creditAmount: 5000,
        status: 'claimed',
      },
    },
  });
  assert.deepEqual(calls, [
    ['findPromoById', 'promo-1'],
    ['findUserById', 'user-1'],
    ['checkUserEligibility', { promo, user }],
    ['createPromoClaim', {
      userId: 'user-1',
      promoId: 'promo-1',
      creditAmount: 5000,
    }],
    ['incrementClaimedSlots', 'promo-1'],
  ]);
});

test('ClaimPromoCreditUseCase credits wallet, marks claim credited, and records activity for auto-credit promos', async () => {
  const firstDate = new Date('2026-05-20T10:00:00.000Z');
  const secondDate = new Date('2026-05-20T10:00:01.000Z');
  const dates = [firstDate, secondDate];
  const calls = [];
  const promo = {
    _id: 'promo-1',
    name: 'Launch credit',
    creditAmount: 5000,
    autoCredit: true,
  };
  const user = {
    _id: 'user-1',
    role: 'marketer',
  };
  const promoClaim = {
    _id: 'claim-1',
    status: 'claimed',
  };
  const useCase = new ClaimPromoCreditUseCase({
    now: () => dates.shift(),
    promoOfferGateway: {
      async findPromoById() {
        return promo;
      },
      async findUserById() {
        return user;
      },
      async checkUserEligibility() {
        return { eligible: true };
      },
      async createPromoClaim() {
        return promoClaim;
      },
      async incrementClaimedSlots(promoId) {
        calls.push(['incrementClaimedSlots', promoId]);
      },
      async creditUserWallet(command) {
        calls.push(['creditUserWallet', command]);
      },
      async appendUserWalletTransaction(command) {
        calls.push(['appendUserWalletTransaction', command]);
      },
      async markPromoClaimCredited(command) {
        calls.push(['markPromoClaimCredited', command]);
        promoClaim.status = 'credited';
      },
      async recordPromoCreditActivity(command) {
        calls.push(['recordPromoCreditActivity', command]);
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
      message: 'Promotional credit claimed successfully',
      data: {
        claimId: 'claim-1',
        creditAmount: 5000,
        status: 'credited',
      },
    },
  });
  assert.deepEqual(calls, [
    ['incrementClaimedSlots', 'promo-1'],
    ['creditUserWallet', {
      userId: 'user-1',
      role: 'marketer',
      amount: 5000,
    }],
    ['appendUserWalletTransaction', {
      userId: 'user-1',
      role: 'marketer',
      transaction: {
        amount: 5000,
        type: 'credit',
        category: 'bonus',
        description: 'Promotional credit: Launch credit',
        status: 'successful',
        createdAt: firstDate,
      },
    }],
    ['markPromoClaimCredited', {
      promoClaim,
      creditedAt: secondDate,
    }],
    ['recordPromoCreditActivity', {
      user,
      promo,
    }],
  ]);
});

test('ClaimPromoCreditUseCase lets duplicate claim errors propagate to controller failure paths', async () => {
  const duplicateError = new Error('duplicate promo claim');
  duplicateError.code = 11000;
  const useCase = new ClaimPromoCreditUseCase({
    promoOfferGateway: {
      async findPromoById() {
        return { _id: 'promo-1', creditAmount: 5000 };
      },
      async findUserById() {
        return { _id: 'user-1' };
      },
      async checkUserEligibility() {
        return { eligible: true };
      },
      async createPromoClaim() {
        throw duplicateError;
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      promoId: 'promo-1',
      userId: 'user-1',
    }),
    (error) => error.code === 11000,
  );
});
