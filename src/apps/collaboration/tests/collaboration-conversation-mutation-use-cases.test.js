import test from 'node:test';
import assert from 'node:assert/strict';

import { CreateDirectConversationDto } from '../application/dto/create-direct-conversation.dto.js';
import { OpenCampaignConversationDto } from '../application/dto/open-campaign-conversation.dto.js';
import { OpenPromotionConversationDto } from '../application/dto/open-promotion-conversation.dto.js';
import { SendConversationMessageDto } from '../application/dto/send-conversation-message.dto.js';
import { CreateDirectConversationUseCase } from '../application/use-cases/create-direct-conversation.use-case.js';
import { OpenCampaignConversationUseCase } from '../application/use-cases/open-campaign-conversation.use-case.js';
import { OpenPromotionConversationUseCase } from '../application/use-cases/open-promotion-conversation.use-case.js';
import { SendConversationMessageUseCase } from '../application/use-cases/send-conversation-message.use-case.js';

const conversationFixture = {
  _id: 'conversation-1',
  type: 'direct',
  title: 'Direct support',
  participants: [
    {
      user: {
        _id: 'user-1',
        displayName: 'Sender',
        username: 'sender',
        avatar: 'sender.png',
        role: 'marketer',
        isVerified: true,
      },
      role: 'marketer',
    },
    {
      user: {
        _id: 'user-2',
        displayName: 'Receiver',
        username: 'receiver',
        avatar: 'receiver.png',
        role: 'promoter',
        isVerified: false,
      },
      role: 'promoter',
    },
  ],
  campaign: null,
  promotion: null,
  metadata: {},
  lastMessageAt: null,
  lastMessagePreview: '',
  lastMessageBy: null,
  isArchived: false,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
};

test('CreateDirectConversationUseCase preserves legacy direct conversation response shape', async () => {
  let command = null;
  const useCase = new CreateDirectConversationUseCase({
    collaborationConversationGateway: {
      async createDirectConversation(input) {
        command = input;
        return conversationFixture;
      },
    },
  });

  const user = { _id: 'user-1', role: 'marketer' };
  const result = await useCase.execute(CreateDirectConversationDto.fromRequest({
    user,
    body: {
      targetUserId: 'user-2',
      campaignId: 'campaign-1',
      promotionId: 'promotion-1',
    },
  }));

  assert.deepEqual(command, {
    actor: user,
    targetUserId: 'user-2',
    campaignId: 'campaign-1',
    promotionId: 'promotion-1',
  });
  assert.equal(result.statusCode, 201);
  assert.equal(result.body.success, true);
  assert.equal(result.body.data._id, 'conversation-1');
  assert.equal(result.body.data.counterpart._id, 'user-2');
});

test('Open campaign and promotion conversation use cases preserve legacy gateway commands', async () => {
  const calls = [];
  const user = { _id: 'user-1', role: 'marketer' };
  const campaignUseCase = new OpenCampaignConversationUseCase({
    collaborationConversationGateway: {
      async openCampaignConversation(command) {
        calls.push(['campaign', command]);
        return {
          ...conversationFixture,
          type: 'campaign_room',
          campaign: { _id: 'campaign-1', title: 'Launch', status: 'active' },
        };
      },
    },
  });
  const promotionUseCase = new OpenPromotionConversationUseCase({
    collaborationConversationGateway: {
      async openPromotionConversation(command) {
        calls.push(['promotion', command]);
        return {
          ...conversationFixture,
          type: 'promotion_room',
          promotion: { _id: 'promotion-1', upi: 'UPI-1', status: 'accepted' },
        };
      },
    },
  });

  const campaignResult = await campaignUseCase.execute(OpenCampaignConversationDto.fromRequest({
    user,
    params: { campaignId: 'campaign-1' },
  }));
  const promotionResult = await promotionUseCase.execute(OpenPromotionConversationDto.fromRequest({
    user,
    params: { promotionId: 'promotion-1' },
  }));

  assert.deepEqual(calls, [
    ['campaign', { actor: user, campaignId: 'campaign-1' }],
    ['promotion', { actor: user, promotionId: 'promotion-1' }],
  ]);
  assert.equal(campaignResult.statusCode, 200);
  assert.equal(campaignResult.body.data.campaign._id, 'campaign-1');
  assert.equal(promotionResult.statusCode, 200);
  assert.equal(promotionResult.body.data.promotion.upi, 'UPI-1');
});

test('SendConversationMessageUseCase preserves missing content guard before writes', async () => {
  const useCase = new SendConversationMessageUseCase({
    collaborationConversationGateway: {
      async loadConversationForUser() {
        throw new Error('should not load conversation');
      },
    },
    collaborationNotificationGateway: {
      async createMessageNotification() {
        throw new Error('should not notify');
      },
    },
    collaborationRealtimeGateway: {
      notifyMessage() {
        throw new Error('should not publish');
      },
      notifyConversationUpdate() {
        throw new Error('should not publish update');
      },
    },
  });

  assert.deepEqual(await useCase.execute(new SendConversationMessageDto({
    user: { _id: 'user-1' },
    conversationId: 'conversation-1',
    content: '   ',
  })), {
    statusCode: 400,
    body: {
      success: false,
      message: 'Message content is required.',
    },
  });
});

test('SendConversationMessageUseCase writes message, updates conversation, publishes realtime events, and notifies recipients', async () => {
  const calls = [];
  const createdAt = new Date('2026-06-04T12:00:00.000Z');
  const createdMessage = {
    _id: 'message-1',
    createdAt,
  };
  const populatedMessage = {
    _id: 'message-1',
    content: 'Hello partner',
    sender: { _id: 'user-1', displayName: 'Sender' },
  };
  const io = { id: 'socket-server' };
  const sender = { _id: 'user-1', displayName: 'Sender', username: 'sender' };
  const attachments = [{ kind: 'link', label: 'Brief', url: 'https://example.test' }];
  const useCase = new SendConversationMessageUseCase({
    collaborationConversationGateway: {
      async loadConversationForUser(conversationId, user) {
        calls.push(['load', conversationId, user._id]);
        return conversationFixture;
      },
      async createMessage(command) {
        calls.push(['createMessage', command]);
        return createdMessage;
      },
      async updateConversationLastMessage(command) {
        calls.push(['updateConversation', command]);
      },
      async getMessageById(messageId) {
        calls.push(['getMessage', messageId]);
        return populatedMessage;
      },
    },
    collaborationNotificationGateway: {
      async createMessageNotification(command) {
        calls.push(['notify', command]);
      },
    },
    collaborationRealtimeGateway: {
      notifyMessage(command) {
        calls.push(['realtimeMessage', command]);
      },
      notifyConversationUpdate(command) {
        calls.push(['realtimeConversation', command]);
      },
    },
  });

  const result = await useCase.execute(new SendConversationMessageDto({
    user: sender,
    conversationId: 'conversation-1',
    content: '  Hello partner  ',
    attachments,
    io,
  }));

  assert.deepEqual(calls, [
    ['load', 'conversation-1', 'user-1'],
    ['createMessage', {
      conversationId: 'conversation-1',
      senderId: 'user-1',
      content: 'Hello partner',
      attachments,
    }],
    ['updateConversation', {
      conversationId: 'conversation-1',
      lastMessageAt: createdAt,
      lastMessagePreview: 'Hello partner',
      lastMessageBy: 'user-1',
    }],
    ['getMessage', 'message-1'],
    ['realtimeMessage', {
      io,
      conversationId: 'conversation-1',
      participantIds: ['user-1', 'user-2'],
      message: populatedMessage,
    }],
    ['realtimeConversation', {
      io,
      participantIds: ['user-1', 'user-2'],
      payload: {
        conversationId: 'conversation-1',
        lastMessageAt: createdAt,
        lastMessagePreview: 'Hello partner',
        lastMessageBy: 'user-1',
      },
    }],
    ['notify', {
      recipientId: 'user-2',
      conversation: {
        _id: 'conversation-1',
        title: 'Direct support',
        type: 'direct',
      },
      sender,
      content: 'Hello partner',
    }],
  ]);
  assert.deepEqual(result, {
    statusCode: 201,
    body: {
      success: true,
      data: populatedMessage,
    },
  });
});

test('Conversation mutation use cases let gateway errors propagate to controller failure paths', async () => {
  const useCase = new OpenCampaignConversationUseCase({
    collaborationConversationGateway: {
      async openCampaignConversation() {
        throw new Error('campaign room unavailable');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new OpenCampaignConversationDto({
      user: { _id: 'user-1' },
      campaignId: 'campaign-1',
    })),
    /campaign room unavailable/,
  );
});
