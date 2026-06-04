import test from 'node:test';
import assert from 'node:assert/strict';

import { WithdrawLoginStreakPointsDto } from '../application/dto/withdraw-login-streak-points.dto.js';
import { WithdrawLoginStreakPointsUseCase } from '../application/use-cases/withdraw-login-streak-points.use-case.js';

test('WithdrawLoginStreakPointsUseCase preserves user id, payload, and response shape', async () => {
  let gatewayArgs = null;
  const response = {
    success: true,
    message: 'Successfully moved 7 streak points to your promoter wallet.',
    data: {
      walletType: 'promoter',
      pointsWithdrawn: 7,
      amountCredited: 1050,
      reference: 'STREAK-REF-1',
      status: {
        currentStreak: 7,
        withdrawablePoints: 0,
      },
    },
  };

  const useCase = new WithdrawLoginStreakPointsUseCase({
    loginStreakWithdrawalGateway: {
      async withdrawLoginStreakPoints(userId, payload) {
        gatewayArgs = { userId, payload };
        return response;
      },
    },
  });

  const result = await useCase.execute(
    WithdrawLoginStreakPointsDto.fromRequest({
      userId: 'user-1',
      body: {
        walletType: 'promoter',
        points: 7,
      },
    }),
  );

  assert.deepEqual(result, response);
  assert.deepEqual(gatewayArgs, {
    userId: 'user-1',
    payload: {
      walletType: 'promoter',
      points: 7,
    },
  });
});

test('WithdrawLoginStreakPointsUseCase preserves legacy default empty payload', async () => {
  let gatewayArgs = null;
  const useCase = new WithdrawLoginStreakPointsUseCase({
    loginStreakWithdrawalGateway: {
      async withdrawLoginStreakPoints(userId, payload) {
        gatewayArgs = { userId, payload };
        return {
          success: true,
          data: {
            walletType: 'marketer',
          },
        };
      },
    },
  });

  await useCase.execute(
    WithdrawLoginStreakPointsDto.fromRequest({
      userId: 'user-1',
      body: null,
    }),
  );

  assert.deepEqual(gatewayArgs, {
    userId: 'user-1',
    payload: {},
  });
});

test('WithdrawLoginStreakPointsUseCase lets gateway errors propagate to controller failure paths', async () => {
  const useCase = new WithdrawLoginStreakPointsUseCase({
    loginStreakWithdrawalGateway: {
      async withdrawLoginStreakPoints() {
        throw new Error('No withdrawable streak points available');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ userId: 'user-1', payload: {} }),
    /No withdrawable streak points available/,
  );
});
