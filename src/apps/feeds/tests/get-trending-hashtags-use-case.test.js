import test from 'node:test';
import assert from 'node:assert/strict';

import { GetTrendingHashtagsDto } from '../application/dto/get-trending-hashtags.dto.js';
import { GetTrendingHashtagsUseCase } from '../application/use-cases/get-trending-hashtags.use-case.js';

test('GetTrendingHashtagsDto preserves the legacy fixed limit', () => {
  assert.deepEqual(GetTrendingHashtagsDto.fromRequest(), new GetTrendingHashtagsDto({
    limit: 20,
  }));
});

test('GetTrendingHashtagsUseCase returns the legacy ApiResponse JSON shape', async () => {
  const calls = [];
  const hashtags = [
    {
      _id: 'marketspase',
      tag: 'marketspase',
      count: 3,
      posts: ['post-1', 'post-2', 'post-3'],
    },
  ];
  const useCase = new GetTrendingHashtagsUseCase({
    feedTrendingGateway: {
      async getTrendingHashtags(command) {
        calls.push(['getTrendingHashtags', command]);
        return hashtags;
      },
    },
  });

  assert.deepEqual(await useCase.execute(GetTrendingHashtagsDto.fromRequest()), {
    statusCode: 200,
    body: {
      statusCode: 200,
      data: hashtags,
      message: 'Trending hashtags fetched',
      success: true,
    },
  });
  assert.deepEqual(calls, [['getTrendingHashtags', { limit: 20 }]]);
});

test('GetTrendingHashtagsUseCase preserves empty hashtag response', async () => {
  const useCase = new GetTrendingHashtagsUseCase({
    feedTrendingGateway: {
      async getTrendingHashtags() {
        return [];
      },
    },
  });

  assert.deepEqual(await useCase.execute({ limit: 20 }), {
    statusCode: 200,
    body: {
      statusCode: 200,
      data: [],
      message: 'Trending hashtags fetched',
      success: true,
    },
  });
});

test('GetTrendingHashtagsUseCase lets gateway errors propagate to asyncHandler failure paths', async () => {
  const useCase = new GetTrendingHashtagsUseCase({
    feedTrendingGateway: {
      async getTrendingHashtags() {
        throw new Error('hashtag aggregate failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new GetTrendingHashtagsDto()),
    /hashtag aggregate failed/,
  );
});
