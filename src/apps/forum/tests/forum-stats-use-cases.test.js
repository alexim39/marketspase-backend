import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GetActiveUsersDto,
  GetCommunityStatsDto,
  GetHotTopicsDto,
  GetPinnedThreadsDto,
  GetPopularTagsDto,
  GetTrendingThreadsDto,
} from '../application/dto/forum-stats-query.dto.js';
import { GetActiveUsersUseCase } from '../application/use-cases/get-active-users.use-case.js';
import { GetCommunityStatsUseCase } from '../application/use-cases/get-community-stats.use-case.js';
import { GetHotTopicsUseCase } from '../application/use-cases/get-hot-topics.use-case.js';
import { GetPinnedThreadsUseCase } from '../application/use-cases/get-pinned-threads.use-case.js';
import { GetPopularTagsUseCase } from '../application/use-cases/get-popular-tags.use-case.js';
import { GetTrendingThreadsUseCase } from '../application/use-cases/get-trending-threads.use-case.js';

test('GetCommunityStatsUseCase preserves the legacy community stats response shape', async () => {
  let query = null;
  const useCase = new GetCommunityStatsUseCase({
    forumStatsGateway: {
      async getCommunityStats(input) {
        query = input;
        return {
          totalMembers: 10,
          totalDiscussions: 4,
          totalComments: 6,
          todayDiscussions: 2,
          todayComments: 3,
        };
      },
    },
  });

  const result = await useCase.execute(GetCommunityStatsDto.fromRequest({}));

  assert.equal(query.today instanceof Date, true);
  assert.equal(query.today.getHours(), 0);
  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      data: {
        totalMembers: 10,
        totalDiscussions: 4,
        totalComments: 6,
        todayDiscussions: 2,
        todayComments: 3,
        todayActivity: 5,
      },
    },
  });
});

test('GetPinnedThreadsUseCase preserves limit clamp, viewer id, URL, and count contract', async () => {
  let query = null;
  const useCase = new GetPinnedThreadsUseCase({
    forumStatsGateway: {
      async listPinnedThreads(input) {
        query = input;
        return [
          {
            _id: 'thread-1',
            title: 'Pinned',
            likeCount: 2,
          },
        ];
      },
    },
  });

  const result = await useCase.execute(GetPinnedThreadsDto.fromRequest({
    user: { _id: { toString: () => 'viewer-1' } },
    query: { limit: '200' },
  }));

  assert.deepEqual(query, {
    limit: 20,
    userId: 'viewer-1',
  });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.count, 1);
  assert.equal(result.body.data[0].url, '/dashboard/community/discussion/thread-1');
});

test('GetTrendingThreadsUseCase preserves timeframe parsing and stats mapping', async () => {
  let query = null;
  const useCase = new GetTrendingThreadsUseCase({
    forumStatsGateway: {
      async getThreadHighlights(input) {
        query = input;
        return [
          {
            _id: 'thread-1',
            trendingScore: 44,
            viewCount: 12,
            likeCount: 4,
            commentCount: 3,
          },
        ];
      },
    },
  });

  const result = await useCase.execute(GetTrendingThreadsDto.fromRequest({
    userId: 'viewer-2',
    query: { limit: '3', timeframe: 'month' },
  }));

  assert.deepEqual(query, {
    limit: 3,
    timeframeDays: 30,
    userId: 'viewer-2',
  });
  assert.equal(result.body.timeframe, 'month');
  assert.equal(result.body.data[0].activityCount, 44);
  assert.deepEqual(result.body.data[0].stats, {
    views: 12,
    likes: 4,
    comments: 3,
  });
});

test('GetActiveUsersUseCase preserves contributor spotlight card fields', async () => {
  let query = null;
  const useCase = new GetActiveUsersUseCase({
    forumStatsGateway: {
      async getContributorSpotlight(input) {
        query = input;
        return [
          {
            _id: 'abc123',
            displayName: 'Ada Lovelace',
            username: 'ada',
            avatar: 'ada.png',
            threadCount: 8,
            commentCount: 11,
            engagementPoints: 92,
            role: 'marketer',
            badge: 'Expert',
          },
        ];
      },
    },
  });

  const result = await useCase.execute(GetActiveUsersDto.fromRequest({
    query: { timeframe: 'week', limit: '4' },
  }));

  assert.deepEqual(query, {
    limit: 4,
    timeframeDays: 7,
  });
  assert.equal(result.body.timeframe, 'week');
  assert.equal(result.body.data[0].id, 'abc123');
  assert.equal(result.body.data[0].initials, 'AL');
  assert.equal(result.body.data[0].postCount, 8);
  assert.equal(result.body.data[0].totalLikes, 92);
});

test('GetPopularTagsUseCase preserves tag list and detail payloads', async () => {
  let query = null;
  const topics = [
    { topic: 'marketing', engagementScore: 25 },
    { topic: 'sales', engagementScore: 12 },
  ];
  const useCase = new GetPopularTagsUseCase({
    forumStatsGateway: {
      async getHotTopics(input) {
        query = input;
        return topics;
      },
    },
  });

  const result = await useCase.execute(GetPopularTagsDto.fromRequest({
    query: { timeframe: 'all' },
  }));

  assert.deepEqual(query, {
    limit: 10,
    timeframeDays: 3650,
  });
  assert.deepEqual(result.body.data, ['marketing', 'sales']);
  assert.deepEqual(result.body.details, topics);
});

test('GetHotTopicsUseCase preserves hot topic timeframe response', async () => {
  let query = null;
  const topics = [{ topic: 'growth', engagementScore: 30 }];
  const useCase = new GetHotTopicsUseCase({
    forumStatsGateway: {
      async getHotTopics(input) {
        query = input;
        return topics;
      },
    },
  });

  const result = await useCase.execute(GetHotTopicsDto.fromRequest({
    query: { timeframe: 'day', limit: '2' },
  }));

  assert.deepEqual(query, {
    limit: 2,
    timeframeDays: 1,
  });
  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      success: true,
      data: topics,
      timeframe: 'day',
    },
  });
});

test('Forum stats use cases let gateway errors propagate to controller failure paths', async () => {
  const useCase = new GetHotTopicsUseCase({
    forumStatsGateway: {
      async getHotTopics() {
        throw new Error('topic query failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new GetHotTopicsDto()),
    /topic query failed/,
  );
});
