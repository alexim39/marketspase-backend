import test from 'node:test';
import assert from 'node:assert/strict';

import { PingLoginStreakSessionDto } from '../application/dto/ping-login-streak-session.dto.js';
import { StartLoginStreakSessionDto } from '../application/dto/start-login-streak-session.dto.js';
import { PingLoginStreakSessionUseCase } from '../application/use-cases/ping-login-streak-session.use-case.js';
import { StartLoginStreakSessionUseCase } from '../application/use-cases/start-login-streak-session.use-case.js';

test('StartLoginStreakSessionUseCase preserves user id, metadata, and response shape', async () => {
  let gatewayArgs = null;
  const response = {
    success: true,
    data: {
      sessionId: 'session-1',
      activeSecondsAccumulated: 0,
      qualifiedToday: false,
    },
  };

  const useCase = new StartLoginStreakSessionUseCase({
    loginStreakSessionGateway: {
      async startLoginStreakSession(userId, metadata) {
        gatewayArgs = { userId, metadata };
        return response;
      },
    },
  });

  const result = await useCase.execute(
    StartLoginStreakSessionDto.fromRequest({
      userId: 'user-1',
      metadata: {
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
      },
    }),
  );

  assert.deepEqual(result, response);
  assert.deepEqual(gatewayArgs, {
    userId: 'user-1',
    metadata: {
      userAgent: 'Mozilla/5.0',
      ipAddress: '127.0.0.1',
    },
  });
});

test('PingLoginStreakSessionUseCase preserves user id, session id, metadata, and response shape', async () => {
  let gatewayArgs = null;
  const response = {
    success: true,
    data: {
      sessionId: 'session-1',
      activeSecondsAccumulated: 30,
      qualifiedToday: false,
    },
  };

  const useCase = new PingLoginStreakSessionUseCase({
    loginStreakSessionGateway: {
      async pingLoginStreakSession(userId, sessionId, metadata) {
        gatewayArgs = { userId, sessionId, metadata };
        return response;
      },
    },
  });

  const result = await useCase.execute(
    PingLoginStreakSessionDto.fromRequest({
      userId: 'user-1',
      body: {
        sessionId: 'session-1',
      },
      metadata: {
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
      },
    }),
  );

  assert.deepEqual(result, response);
  assert.deepEqual(gatewayArgs, {
    userId: 'user-1',
    sessionId: 'session-1',
    metadata: {
      userAgent: 'Mozilla/5.0',
      ipAddress: '127.0.0.1',
    },
  });
});

test('PingLoginStreakSessionUseCase preserves legacy null session fallback', async () => {
  let gatewayArgs = null;
  const useCase = new PingLoginStreakSessionUseCase({
    loginStreakSessionGateway: {
      async pingLoginStreakSession(userId, sessionId, metadata) {
        gatewayArgs = { userId, sessionId, metadata };
        return {
          success: true,
          data: {
            sessionId: 'created-session',
          },
        };
      },
    },
  });

  await useCase.execute(
    PingLoginStreakSessionDto.fromRequest({
      userId: 'user-1',
      body: {},
      metadata: {
        userAgent: 'Mozilla/5.0',
      },
    }),
  );

  assert.deepEqual(gatewayArgs, {
    userId: 'user-1',
    sessionId: null,
    metadata: {
      userAgent: 'Mozilla/5.0',
    },
  });
});

test('Login streak session use cases let gateway errors propagate to controller failure paths', async () => {
  const useCase = new StartLoginStreakSessionUseCase({
    loginStreakSessionGateway: {
      async startLoginStreakSession() {
        throw new Error('User not found');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ userId: 'missing-user', metadata: {} }),
    /User not found/,
  );
});
