import test from 'node:test';
import assert from 'node:assert/strict';

import { TrackPostChatClickDto } from '../application/dto/track-post-chat-click.dto.js';
import { TrackPostChatClickUseCase } from '../application/use-cases/track-post-chat-click.use-case.js';

test('TrackPostChatClickDto preserves legacy postId request source', () => {
  assert.deepEqual(TrackPostChatClickDto.fromRequest({
    params: { postId: 'post-1' },
  }), new TrackPostChatClickDto({
    postId: 'post-1',
  }));
});

test('TrackPostChatClickUseCase preserves post not found response for controller ApiError path', async () => {
  const calls = [];
  const useCase = new TrackPostChatClickUseCase({
    feedChatClickGateway: {
      async trackChatClick(postId) {
        calls.push(['trackChatClick', postId]);
        return null;
      },
    },
  });

  assert.deepEqual(await useCase.execute(new TrackPostChatClickDto({
    postId: 'post-1',
  })), {
    statusCode: 404,
    errorMessage: 'Post not found',
  });
  assert.deepEqual(calls, [['trackChatClick', 'post-1']]);
});

test('TrackPostChatClickUseCase returns legacy ApiResponse JSON shape and chatClicks count', async () => {
  const calls = [];
  const useCase = new TrackPostChatClickUseCase({
    feedChatClickGateway: {
      async trackChatClick(postId) {
        calls.push(['trackChatClick', postId]);
        return {
          socialMetrics: {
            chatClicks: 12,
            externalClicks: 15,
          },
        };
      },
    },
  });

  assert.deepEqual(await useCase.execute({
    postId: 'post-1',
  }), {
    statusCode: 200,
    body: {
      statusCode: 200,
      data: { chatCount: 12 },
      message: 'WhatsApp click tracked successfully',
      success: true,
    },
  });
  assert.deepEqual(calls, [['trackChatClick', 'post-1']]);
});

test('TrackPostChatClickUseCase preserves legacy externalClicks fallback when chatClicks is falsy', async () => {
  const useCase = new TrackPostChatClickUseCase({
    feedChatClickGateway: {
      async trackChatClick() {
        return {
          socialMetrics: {
            chatClicks: 0,
            externalClicks: 8,
          },
        };
      },
    },
  });

  assert.deepEqual(await useCase.execute({
    postId: 'post-1',
  }), {
    statusCode: 200,
    body: {
      statusCode: 200,
      data: { chatCount: 8 },
      message: 'WhatsApp click tracked successfully',
      success: true,
    },
  });
});

test('TrackPostChatClickUseCase lets gateway errors propagate to asyncHandler failure paths', async () => {
  const useCase = new TrackPostChatClickUseCase({
    feedChatClickGateway: {
      async trackChatClick() {
        throw new Error('chat tracking failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new TrackPostChatClickDto({
      postId: 'post-1',
    })),
    /chat tracking failed/,
  );
});
