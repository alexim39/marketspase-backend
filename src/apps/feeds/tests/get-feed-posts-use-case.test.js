import test from 'node:test';
import assert from 'node:assert/strict';

import { GetFeedPostsDto } from '../application/dto/get-feed-posts.dto.js';
import { GetFeedPostsUseCase } from '../application/use-cases/get-feed-posts.use-case.js';

test('GetFeedPostsDto preserves legacy request parsing defaults', () => {
  assert.deepEqual(GetFeedPostsDto.fromRequest({
    query: {},
    userId: 'user-1',
  }), new GetFeedPostsDto({
    page: 1,
    limit: 20,
    sort: 'trending',
    userId: 'user-1',
  }));
});

test('GetFeedPostsUseCase builds legacy query, sort, skip, limit, and response shape', async () => {
  const calls = [];
  const posts = [
    { _id: 'post-1', content: 'First' },
    { _id: 'post-2', content: 'Second' },
  ];
  const shapedPosts = posts.map((post) => ({ ...post, shaped: true }));
  const useCase = new GetFeedPostsUseCase({
    shapePost(post, userId) {
      calls.push(['shapePost', post, userId]);
      return { ...post, shaped: true };
    },
    feedListGateway: {
      async findFeedPosts(command) {
        calls.push(['findFeedPosts', command]);
        return posts;
      },
      async countFeedPosts(query) {
        calls.push(['countFeedPosts', query]);
        return 45;
      },
      async trackFeedImpressions(command) {
        calls.push(['trackFeedImpressions', command]);
      },
    },
  });

  assert.deepEqual(await useCase.execute(GetFeedPostsDto.fromRequest({
    query: {
      page: '2',
      limit: '10',
      type: 'campaign',
      sort: 'most_liked',
      hashtag: 'Growth',
      author: 'author-1',
    },
    userId: 'user-1',
  })), {
    statusCode: 200,
    body: {
      statusCode: 200,
      data: {
        posts: shapedPosts,
        pagination: {
          page: 2,
          limit: 10,
          total: 45,
          pages: 5,
        },
      },
      message: 'Feed fetched successfully',
      success: true,
    },
  });
  assert.deepEqual(calls, [
    ['findFeedPosts', {
      query: {
        status: 'published',
        type: 'campaign',
        'hashtags.tag': 'growth',
        author: 'author-1',
      },
      sortOptions: { likeCount: -1, createdAt: -1 },
      skip: 10,
      limit: 10,
    }],
    ['countFeedPosts', {
      status: 'published',
      type: 'campaign',
      'hashtags.tag': 'growth',
      author: 'author-1',
    }],
    ['shapePost', posts[0], 'user-1'],
    ['shapePost', posts[1], 'user-1'],
    ['trackFeedImpressions', {
      posts: shapedPosts,
      userId: 'user-1',
    }],
  ]);
});

test('GetFeedPostsUseCase preserves legacy sort modes', async () => {
  const sortCases = [
    ['latest', { createdAt: -1 }],
    ['trending', { trendingScore: -1, createdAt: -1 }],
    ['most_liked', { likeCount: -1, createdAt: -1 }],
    ['most_commented', { commentCount: -1, createdAt: -1 }],
    ['unknown', { createdAt: -1 }],
  ];

  for (const [sort, expectedSort] of sortCases) {
    const calls = [];
    const useCase = new GetFeedPostsUseCase({
      feedListGateway: {
        async findFeedPosts(command) {
          calls.push(command);
          return [];
        },
        async countFeedPosts() {
          return 0;
        },
        async trackFeedImpressions() {},
      },
    });

    await useCase.execute({
      page: 1,
      limit: 20,
      sort,
    });

    assert.deepEqual(calls[0].sortOptions, expectedSort);
  }
});

test('GetFeedPostsUseCase swallows impression tracking failures like legacy controller', async () => {
  const useCase = new GetFeedPostsUseCase({
    feedListGateway: {
      async findFeedPosts() {
        return [{ _id: 'post-1' }];
      },
      async countFeedPosts() {
        return 1;
      },
      async trackFeedImpressions() {
        throw new Error('tracking failed');
      },
    },
  });

  assert.deepEqual(await useCase.execute({
    page: 1,
    limit: 20,
  }), {
    statusCode: 200,
    body: {
      statusCode: 200,
      data: {
        posts: [{ _id: 'post-1' }],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
        },
      },
      message: 'Feed fetched successfully',
      success: true,
    },
  });
});

test('GetFeedPostsUseCase lets feed lookup errors propagate to asyncHandler failure paths', async () => {
  const useCase = new GetFeedPostsUseCase({
    feedListGateway: {
      async findFeedPosts() {
        throw new Error('feed lookup failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new GetFeedPostsDto()),
    /feed lookup failed/,
  );
});
