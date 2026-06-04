import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveBannerAudienceScope } from '../domain/banner-message/banner-message-audience.policy.js';
import { CreateBannerMessageDto } from '../application/dto/create-banner-message.dto.js';
import { DeleteBannerMessageDto } from '../application/dto/delete-banner-message.dto.js';
import { DismissBannerMessageDto } from '../application/dto/dismiss-banner-message.dto.js';
import { GetActiveBannerMessagesDto } from '../application/dto/get-active-banner-messages.dto.js';
import { GetDismissedBannerMessagesDto } from '../application/dto/get-dismissed-banner-messages.dto.js';
import { UpdateBannerMessageDto } from '../application/dto/update-banner-message.dto.js';
import { CreateBannerMessageUseCase } from '../application/use-cases/create-banner-message.use-case.js';
import { DeleteBannerMessageUseCase } from '../application/use-cases/delete-banner-message.use-case.js';
import { DismissBannerMessageUseCase } from '../application/use-cases/dismiss-banner-message.use-case.js';
import { GetActiveBannerMessagesUseCase } from '../application/use-cases/get-active-banner-messages.use-case.js';
import { GetDismissedBannerMessagesUseCase } from '../application/use-cases/get-dismissed-banner-messages.use-case.js';
import { UpdateBannerMessageUseCase } from '../application/use-cases/update-banner-message.use-case.js';

test('resolveBannerAudienceScope preserves legacy audience targeting rules', () => {
  assert.deepEqual(resolveBannerAudienceScope(), {
    audiences: ['ALL'],
    groups: [],
  });

  assert.deepEqual(resolveBannerAudienceScope({
    userId: 'user-1',
    isNewUser: true,
    groups: ['beta', '', 'promoters'],
  }), {
    audiences: ['ALL', 'NEW_USERS'],
    groups: ['beta', 'promoters'],
  });

  assert.deepEqual(resolveBannerAudienceScope({
    userId: 'user-2',
    isNewUser: false,
  }), {
    audiences: ['ALL', 'EXISTING_USERS'],
    groups: [],
  });
});

test('GetActiveBannerMessagesUseCase preserves legacy active banner response shape', async () => {
  let gatewayQuery = null;
  const activeBanners = [{ _id: 'banner-1', title: 'Welcome' }];
  const useCase = new GetActiveBannerMessagesUseCase({
    dashboardBannerMessageGateway: {
      async getActiveBannerMessages(query) {
        gatewayQuery = query;
        return activeBanners;
      },
    },
  });

  const result = await useCase.execute(
    GetActiveBannerMessagesDto.fromRequest({
      user: {
        _id: 'user-1',
        isNewUser: false,
        groups: ['marketer'],
      },
    }),
  );

  assert.equal(gatewayQuery.userId, 'user-1');
  assert.equal(gatewayQuery.isNewUser, false);
  assert.deepEqual(gatewayQuery.groups, ['marketer']);
  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      data: activeBanners,
      message: 'Active notifications retrieved successfully',
    },
  });
});

test('DismissBannerMessageUseCase preserves missing user and not-found guards', async () => {
  const useCase = new DismissBannerMessageUseCase({
    dashboardBannerMessageGateway: {
      async findBannerMessageById() {
        assert.fail('gateway should not run without userId');
      },
      async dismissBannerMessage() {
        assert.fail('dismiss should not run without userId');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new DismissBannerMessageDto({
    notificationId: 'banner-1',
  })), {
    statusCode: 401,
    body: {
      success: false,
      message: 'User authentication required',
    },
  });

  const missingUseCase = new DismissBannerMessageUseCase({
    dashboardBannerMessageGateway: {
      async findBannerMessageById() {
        return null;
      },
      async dismissBannerMessage() {
        assert.fail('dismiss should not run when notification is missing');
      },
    },
  });

  assert.deepEqual(await missingUseCase.execute(new DismissBannerMessageDto({
    notificationId: 'banner-1',
    userId: 'user-1',
  })), {
    statusCode: 404,
    body: {
      success: false,
      message: 'Notification not found',
    },
  });
});

test('DismissBannerMessageUseCase dismisses existing notifications with legacy response', async () => {
  let dismissedCommand = null;
  const useCase = new DismissBannerMessageUseCase({
    dashboardBannerMessageGateway: {
      async findBannerMessageById(id) {
        assert.equal(id, 'banner-1');
        return { _id: id };
      },
      async dismissBannerMessage(command) {
        dismissedCommand = command;
        return { acknowledged: true };
      },
    },
  });

  const result = await useCase.execute(DismissBannerMessageDto.fromRequest({
    params: { notificationId: 'banner-1' },
    body: { userId: 'user-1' },
  }));

  assert.deepEqual(dismissedCommand, {
    userId: 'user-1',
    notificationId: 'banner-1',
  });
  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      message: 'Notification dismissed successfully',
    },
  });
});

test('GetDismissedBannerMessagesUseCase preserves param validation and response shape', async () => {
  const useCase = new GetDismissedBannerMessagesUseCase({
    dashboardBannerMessageGateway: {
      async getDismissedBannerMessageIds(userId) {
        assert.equal(userId, 'user-1');
        return ['banner-1'];
      },
    },
  });

  assert.deepEqual(await useCase.execute(new GetDismissedBannerMessagesDto()), {
    statusCode: 400,
    body: {
      success: false,
      data: [],
      message: 'User ID is required',
    },
  });

  assert.deepEqual(await useCase.execute(new GetDismissedBannerMessagesDto({ userId: 'user-1' })), {
    statusCode: 200,
    body: {
      success: true,
      data: ['banner-1'],
    },
  });
});

test('Banner admin create/update/delete use cases preserve legacy response contracts', async () => {
  const created = { _id: 'banner-1', title: 'Created' };
  const updated = { _id: 'banner-1', title: 'Updated' };

  const createUseCase = new CreateBannerMessageUseCase({
    dashboardBannerMessageGateway: {
      async createBannerMessage(data) {
        assert.deepEqual(data, { title: 'Created' });
        return created;
      },
    },
  });
  const updateUseCase = new UpdateBannerMessageUseCase({
    dashboardBannerMessageGateway: {
      async updateBannerMessage(command) {
        assert.deepEqual(command, {
          id: 'banner-1',
          data: { title: 'Updated' },
        });
        return updated;
      },
    },
  });
  const deleteUseCase = new DeleteBannerMessageUseCase({
    dashboardBannerMessageGateway: {
      async deleteBannerMessage(id) {
        assert.equal(id, 'banner-1');
        return { _id: 'banner-1' };
      },
    },
  });

  assert.deepEqual(await createUseCase.execute(new CreateBannerMessageDto({
    data: { title: 'Created' },
  })), {
    statusCode: 201,
    body: {
      success: true,
      data: created,
      message: 'Notification created successfully',
    },
  });

  assert.deepEqual(await updateUseCase.execute(new UpdateBannerMessageDto({
    id: 'banner-1',
    data: { title: 'Updated' },
  })), {
    statusCode: 200,
    body: {
      success: true,
      data: updated,
      message: 'Notification updated successfully',
    },
  });

  assert.deepEqual(await deleteUseCase.execute(new DeleteBannerMessageDto({
    id: 'banner-1',
  })), {
    statusCode: 200,
    body: {
      success: true,
      message: 'Notification deleted successfully',
    },
  });
});

test('Banner admin update/delete use cases preserve legacy not-found response contracts', async () => {
  const updateUseCase = new UpdateBannerMessageUseCase({
    dashboardBannerMessageGateway: {
      async updateBannerMessage() {
        return null;
      },
    },
  });
  const deleteUseCase = new DeleteBannerMessageUseCase({
    dashboardBannerMessageGateway: {
      async deleteBannerMessage() {
        return null;
      },
    },
  });

  assert.deepEqual(await updateUseCase.execute(new UpdateBannerMessageDto({
    id: 'missing',
    data: {},
  })), {
    statusCode: 404,
    body: {
      success: false,
      message: 'Notification not found',
    },
  });

  assert.deepEqual(await deleteUseCase.execute(new DeleteBannerMessageDto({
    id: 'missing',
  })), {
    statusCode: 404,
    body: {
      success: false,
      message: 'Notification not found',
    },
  });
});
