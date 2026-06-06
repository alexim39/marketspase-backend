import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { GetConversationMessagesDto } from '../application/dto/get-conversation-messages.dto.js';
import { ListConversationsDto } from '../application/dto/list-conversations.dto.js';
import { MarkConversationReadDto } from '../application/dto/mark-conversation-read.dto.js';
import {
  serializeCollaborationConversation,
  toCollaborationIdString,
} from '../application/mappers/collaboration-conversation.mapper.js';
import { GetConversationMessagesUseCase } from '../application/use-cases/get-conversation-messages.use-case.js';
import { ListConversationsUseCase } from '../application/use-cases/list-conversations.use-case.js';
import { MarkConversationReadUseCase } from '../application/use-cases/mark-conversation-read.use-case.js';

const conversationFixture = {
  _id: 'conversation-1',
  type: 'direct',
  title: 'Direct support',
  participants: [
    {
      user: {
        _id: 'user-1',
        displayName: 'Current User',
        username: 'current',
        avatar: 'current.png',
        role: 'marketer',
        isVerified: true,
      },
      role: 'marketer',
    },
    {
      user: {
        _id: 'user-2',
        displayName: 'Partner',
        username: 'partner',
        avatar: 'partner.png',
        role: 'promoter',
        isVerified: false,
      },
      role: 'promoter',
    },
  ],
  campaign: {
    _id: 'campaign-1',
    title: 'Launch',
    status: 'active',
  },
  promotion: {
    _id: 'promotion-1',
    upi: 'upi-1',
    status: 'accepted',
  },
  metadata: {
    entityLabel: 'Launch',
  },
  lastMessageAt: '2026-06-04T00:00:00.000Z',
  lastMessagePreview: 'Hello there',
  lastMessageBy: 'user-2',
  isArchived: false,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
};

test('serializeCollaborationConversation preserves legacy conversation payload shape', () => {
  assert.deepEqual(serializeCollaborationConversation(conversationFixture, 'user-1', 3), {
    _id: 'conversation-1',
    type: 'direct',
    title: 'Direct support',
    participants: [
      {
        user: {
          _id: 'user-1',
          displayName: 'Current User',
          username: 'current',
          avatar: 'current.png',
          role: 'marketer',
          isVerified: true,
        },
        role: 'marketer',
      },
      {
        user: {
          _id: 'user-2',
          displayName: 'Partner',
          username: 'partner',
          avatar: 'partner.png',
          role: 'promoter',
          isVerified: false,
        },
        role: 'promoter',
      },
    ],
    counterpart: {
      _id: 'user-2',
      displayName: 'Partner',
      username: 'partner',
      avatar: 'partner.png',
      role: 'promoter',
      isVerified: false,
    },
    campaign: {
      _id: 'campaign-1',
      title: 'Launch',
      status: 'active',
    },
    promotion: {
      _id: 'promotion-1',
      upi: 'upi-1',
      status: 'accepted',
    },
    metadata: {
      entityLabel: 'Launch',
    },
    lastMessageAt: '2026-06-04T00:00:00.000Z',
    lastMessagePreview: 'Hello there',
    lastMessageBy: 'user-2',
    unreadCount: 3,
    isArchived: false,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-04T00:00:00.000Z',
  });
});

test('toCollaborationIdString serializes Mongoose ObjectIds without recursive _id lookups', () => {
  const objectId = new mongoose.Types.ObjectId();

  assert.equal(toCollaborationIdString(objectId), objectId.toHexString());
  assert.equal(toCollaborationIdString({ _id: objectId }), objectId.toHexString());
});

test('ListConversationsUseCase preserves query parsing, search filtering, cache header, and unread counts', async () => {
  let listQuery = null;
  let unreadQuery = null;
  const useCase = new ListConversationsUseCase({
    collaborationConversationGateway: {
      async listConversations(query) {
        listQuery = query;
        return [
          conversationFixture,
          {
            ...conversationFixture,
            _id: 'conversation-2',
            title: 'Another thread',
            lastMessagePreview: 'Different',
            campaign: null,
            promotion: null,
            metadata: {},
            participants: [],
          },
        ];
      },
      async getUnreadCounts(query) {
        unreadQuery = query;
        return new Map([['conversation-1', 2]]);
      },
    },
  });

  const result = await useCase.execute(ListConversationsDto.fromRequest({
    user: { _id: 'user-1' },
    query: {
      kind: 'direct',
      search: 'partner',
      limit: '200',
    },
  }));

  assert.deepEqual(listQuery, {
    userId: 'user-1',
    kind: 'direct',
    limit: 50,
  });
  assert.deepEqual(unreadQuery, {
    conversationIds: ['conversation-1'],
    userId: 'user-1',
  });
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.length, 1);
  assert.equal(result.body.data[0].unreadCount, 2);
  assert.equal(result.body.data[0].counterpart.displayName, 'Partner');
});

test('GetConversationMessagesUseCase preserves conversation, message, and pagination response shape', async () => {
  const messages = [{ _id: 'message-1', content: 'Hello' }];
  const calls = [];
  const useCase = new GetConversationMessagesUseCase({
    collaborationConversationGateway: {
      async loadConversationForUser(conversationId, user) {
        calls.push(['load', conversationId, user._id]);
        return conversationFixture;
      },
      async listMessages(query) {
        calls.push(['messages', query]);
        return {
          messages,
          total: 21,
        };
      },
    },
  });

  const result = await useCase.execute(GetConversationMessagesDto.fromRequest({
    user: { _id: 'user-1' },
    params: { conversationId: 'conversation-1' },
    query: { page: '2', limit: '20' },
  }));

  assert.deepEqual(calls, [
    ['load', 'conversation-1', 'user-1'],
    ['messages', {
      conversationId: 'conversation-1',
      page: 2,
      limit: 20,
    }],
  ]);
  assert.deepEqual(result.body.data.messages, messages);
  assert.deepEqual(result.body.data.pagination, {
    page: 2,
    limit: 20,
    total: 21,
    totalPages: 2,
  });
  assert.equal(result.body.data.conversation._id, 'conversation-1');
});

test('MarkConversationReadUseCase preserves access load and success message', async () => {
  const calls = [];
  const useCase = new MarkConversationReadUseCase({
    collaborationConversationGateway: {
      async loadConversationForUser(conversationId, user) {
        calls.push(['load', conversationId, user._id]);
        return conversationFixture;
      },
      async markConversationRead(command) {
        calls.push(['mark', command]);
      },
    },
  });

  const result = await useCase.execute(MarkConversationReadDto.fromRequest({
    user: { _id: 'user-1' },
    params: { conversationId: 'conversation-1' },
  }));

  assert.deepEqual(calls, [
    ['load', 'conversation-1', 'user-1'],
    ['mark', {
      conversationId: 'conversation-1',
      userId: 'user-1',
    }],
  ]);
  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      message: 'Conversation marked as read.',
    },
  });
});

test('Collaboration conversation read use cases let gateway errors propagate to controller failure paths', async () => {
  const useCase = new GetConversationMessagesUseCase({
    collaborationConversationGateway: {
      async loadConversationForUser() {
        throw new Error('conversation unavailable');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new GetConversationMessagesDto({
      user: { _id: 'user-1' },
      conversationId: 'conversation-1',
    })),
    /conversation unavailable/,
  );
});
