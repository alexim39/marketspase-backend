import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GetProfileDto,
  GetSuggestedUsersDto,
  GetUserPostsDto,
  ListFollowersDto,
  ListFollowingDto,
  ToggleFollowDto,
} from '../application/dto/profile-social-query.dto.js';
import { GetProfileUseCase } from '../application/use-cases/get-profile.use-case.js';
import { GetSuggestedUsersUseCase } from '../application/use-cases/get-suggested-users.use-case.js';
import { GetUserPostsUseCase } from '../application/use-cases/get-user-posts.use-case.js';
import { ListFollowersUseCase } from '../application/use-cases/list-followers.use-case.js';
import { ListFollowingUseCase } from '../application/use-cases/list-following.use-case.js';
import { ToggleFollowUseCase } from '../application/use-cases/toggle-follow.use-case.js';

const PROFILE_USER_ID = '507f1f77bcf86cd799439011';
const PROFILE_VIEWER_ID = '507f191e810c19729de860ea';

test('GetProfileUseCase preserves invalid profile ID guard', async () => {
  const useCase = new GetProfileUseCase({
    profileSocialGateway: {
      isValidObjectId() {
        return false;
      },
    },
  });

  const result = await useCase.execute(new GetProfileDto({
    userId: 'not-an-object-id',
  }));

  assert.deepEqual(result, {
    statusCode: 400,
    body: {
      message: 'Invalid user ID',
    },
  });
});

test('GetProfileUseCase preserves missing user response', async () => {
  let baseStatsCalled = false;
  const useCase = new GetProfileUseCase({
    profileSocialGateway: {
      isValidObjectId() {
        return true;
      },
      async findProfileUser() {
        return null;
      },
      async getBaseProfileStats() {
        baseStatsCalled = true;
      },
    },
  });

  const result = await useCase.execute(new GetProfileDto({
    userId: PROFILE_USER_ID,
  }));

  assert.equal(baseStatsCalled, false);
  assert.deepEqual(result, {
    statusCode: 404,
    body: {
      message: 'User not found',
    },
  });
});

test('GetProfileUseCase preserves summary profile payload and compact social profiles', async () => {
  const calls = [];
  const fixedNow = Date.UTC(2026, 4, 20, 12, 0, 0);
  const user = {
    _id: PROFILE_USER_ID,
    role: 'marketer',
    displayName: 'Ada',
    professionalInfo: {
      socialProfiles: {
        instagram: ' @ada ',
        website: '',
      },
    },
  };
  const useCase = new GetProfileUseCase({
    now: () => fixedNow,
    profileSocialGateway: {
      isValidObjectId(value) {
        return [PROFILE_USER_ID, PROFILE_VIEWER_ID].includes(String(value));
      },
      async findProfileUser(query) {
        calls.push(['find', query]);
        return user;
      },
      async getBaseProfileStats(query) {
        calls.push(['base', {
          userId: query.userId,
          sinceDate: query.sinceDate.toISOString(),
        }]);
        return {
          userObjectId: { toString: () => PROFILE_USER_ID },
          feedStats: {
            postsCount: 2,
            totalLikes: 5,
            totalComments: 3,
            totalShares: 2,
            totalSaves: 1,
            recentPosts: 1,
          },
          followersCount: 4,
          followingCount: 6,
        };
      },
      async isFollowingUser(query) {
        calls.push(['following', query]);
        return true;
      },
    },
  });

  const result = await useCase.execute(GetProfileDto.fromRequest({
    params: { userId: PROFILE_USER_ID },
    query: {
      currentUserId: PROFILE_VIEWER_ID,
      view: 'summary',
    },
  }));

  assert.deepEqual(calls, [
    ['find', {
      userId: PROFILE_USER_ID,
      summaryView: true,
    }],
    ['base', {
      userId: PROFILE_USER_ID,
      sinceDate: '2026-04-20T12:00:00.000Z',
    }],
    ['following', {
      follower: PROFILE_VIEWER_ID,
      following: PROFILE_USER_ID,
    }],
  ]);
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.postsCount, 2);
  assert.equal(result.body.followersCount, 4);
  assert.equal(result.body.followingCount, 6);
  assert.equal(result.body.totalLikes, 5);
  assert.equal(result.body.totalEngagements, 10);
  assert.deepEqual(result.body.professionalInfo.socialProfiles, {
    instagram: '@ada',
  });
  assert.deepEqual(result.body.socialMetrics, {
    totalEngagements: 10,
    feedPosts: 2,
    feedComments: 3,
    feedShares: 2,
    feedSaves: 1,
    forumThreads: 0,
    forumReplies: 0,
    forumLikes: 0,
    newFollowers30Days: 0,
    profileFollowers: 4,
    storeFollowers: 0,
    recentPosts30Days: 1,
    recentThreads30Days: 0,
    recentReplies30Days: 0,
  });
  assert.equal(result.body.marketerProfile, null);
  assert.equal(result.body.promoterProfile, null);
  assert.equal(result.body.isFollowing, true);
  assert.equal(result.body.isOwnProfile, false);
});

test('GetProfileUseCase preserves detailed marketer profile analytics payload', async () => {
  const calls = [];
  const marketerProfile = {
    storeSummary: {
      totalStoreFollowers: 7,
    },
    analytics: {
      totalCampaigns: 3,
    },
  };
  const useCase = new GetProfileUseCase({
    now: () => Date.UTC(2026, 4, 20, 12, 0, 0),
    profileSocialGateway: {
      isValidObjectId(value) {
        return String(value) === PROFILE_USER_ID;
      },
      async findProfileUser(query) {
        calls.push(['find', query]);
        return {
          _id: PROFILE_USER_ID,
          role: 'marketer',
          rating: 4,
          ratingCount: 9,
          professionalInfo: {
            socialProfiles: {
              x: ' https://x.com/ada ',
            },
          },
        };
      },
      async getBaseProfileStats(query) {
        calls.push(['base', query.userId]);
        return {
          userObjectId: { toString: () => PROFILE_USER_ID },
          feedStats: {
            postsCount: 1,
            totalLikes: 2,
            totalComments: 1,
            totalShares: 1,
            totalSaves: 0,
            recentPosts: 1,
          },
          followersCount: 11,
          followingCount: 12,
        };
      },
      async isFollowingUser() {
        throw new Error('own profile should not query follow state');
      },
      async refreshUserReputation(query) {
        calls.push(['reputation', query.userObjectId.toString()]);
        return {
          rating: 4.8,
          ratingCount: 13,
        };
      },
      async getDetailedProfileSocialStats(query) {
        calls.push(['detail', query.userId]);
        return {
          newFollowersCount: 2,
          threadStats: {
            threadCount: 3,
            totalThreadLikes: 4,
            totalThreadComments: 5,
            totalThreadShares: 1,
            recentThreads: 2,
          },
          commentStats: {
            commentCount: 9,
            totalCommentLikes: 6,
            recentComments: 4,
          },
        };
      },
      async buildMarketerProfile(query) {
        calls.push(['marketer', query.userObjectId.toString()]);
        return marketerProfile;
      },
      async buildPromoterProfile() {
        throw new Error('marketer should not build promoter profile');
      },
    },
  });

  const result = await useCase.execute(new GetProfileDto({
    userId: PROFILE_USER_ID,
    currentUserId: PROFILE_USER_ID,
  }));

  assert.deepEqual(calls, [
    ['find', {
      userId: PROFILE_USER_ID,
      summaryView: false,
    }],
    ['base', PROFILE_USER_ID],
    ['reputation', PROFILE_USER_ID],
    ['detail', PROFILE_USER_ID],
    ['marketer', PROFILE_USER_ID],
  ]);
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.rating, 4.8);
  assert.equal(result.body.ratingCount, 13);
  assert.equal(result.body.totalEngagements, 20);
  assert.deepEqual(result.body.socialMetrics, {
    totalEngagements: 20,
    feedPosts: 1,
    feedComments: 1,
    feedShares: 1,
    feedSaves: 0,
    forumThreads: 3,
    forumReplies: 9,
    forumLikes: 10,
    newFollowers30Days: 2,
    profileFollowers: 11,
    storeFollowers: 7,
    recentPosts30Days: 1,
    recentThreads30Days: 2,
    recentReplies30Days: 4,
  });
  assert.deepEqual(result.body.professionalInfo.socialProfiles, {
    x: 'https://x.com/ada',
  });
  assert.equal(result.body.marketerProfile, marketerProfile);
  assert.equal(result.body.promoterProfile, null);
  assert.equal(result.body.isFollowing, false);
  assert.equal(result.body.isOwnProfile, true);
});

test('GetUserPostsUseCase preserves legacy pagination response and viewer query', async () => {
  let query = null;
  const posts = [{ _id: 'post-1', title: 'Hello' }];
  const useCase = new GetUserPostsUseCase({
    profileSocialGateway: {
      async listUserPosts(input) {
        query = input;
        return {
          posts,
          total: 21,
        };
      },
    },
  });

  const result = await useCase.execute(GetUserPostsDto.fromRequest({
    user: { _id: 'viewer-1' },
    params: { userId: 'user-1' },
    query: { page: '2', limit: '10', currentUserId: 'ignored-viewer' },
  }));

  assert.deepEqual(query, {
    userId: 'user-1',
    page: '2',
    limit: '10',
    pageNumber: 2,
    limitNumber: 10,
    skip: 10,
    currentViewerId: 'viewer-1',
  });
  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      posts,
      total: 21,
      page: 2,
      totalPages: 3,
    },
  });
});

test('ListFollowersUseCase preserves legacy follower list response shape', async () => {
  let query = null;
  const followers = [{ _id: 'user-2', displayName: 'Follower' }];
  const useCase = new ListFollowersUseCase({
    profileSocialGateway: {
      async listFollowers(input) {
        query = input;
        return {
          followers,
          total: 9,
        };
      },
    },
  });

  const result = await useCase.execute(ListFollowersDto.fromRequest({
    params: { userId: 'user-1' },
    query: { page: '3', limit: '4' },
  }));

  assert.deepEqual(query, {
    userId: 'user-1',
    page: '3',
    limit: '4',
    pageNumber: 3,
    limitNumber: 4,
    skip: 8,
  });
  assert.deepEqual(result.body, {
    followers,
    total: 9,
    page: 3,
    totalPages: 3,
  });
});

test('ListFollowingUseCase preserves legacy following list response shape', async () => {
  let query = null;
  const following = [{ _id: 'user-3', displayName: 'Following' }];
  const useCase = new ListFollowingUseCase({
    profileSocialGateway: {
      async listFollowing(input) {
        query = input;
        return {
          following,
          total: 5,
        };
      },
    },
  });

  const result = await useCase.execute(ListFollowingDto.fromRequest({
    params: { userId: 'user-1' },
    query: {},
  }));

  assert.deepEqual(query, {
    userId: 'user-1',
    page: 1,
    limit: 20,
    pageNumber: 1,
    limitNumber: 20,
    skip: 0,
  });
  assert.deepEqual(result.body, {
    following,
    total: 5,
    page: 1,
    totalPages: 1,
  });
});

test('GetSuggestedUsersUseCase preserves suggested users payload with isFollowing false', async () => {
  let query = null;
  const users = [
    { _id: 'user-2', displayName: 'Ada' },
    { _id: 'user-3', displayName: 'Grace', isFollowing: true },
  ];
  const useCase = new GetSuggestedUsersUseCase({
    profileSocialGateway: {
      async listSuggestedUsers(input) {
        query = input;
        return users;
      },
    },
  });

  const result = await useCase.execute(GetSuggestedUsersDto.fromRequest({
    query: { userId: 'user-1', limit: '8' },
  }));

  assert.deepEqual(query, {
    userId: 'user-1',
    limit: 8,
  });
  assert.deepEqual(result, {
    statusCode: 200,
    body: [
      { _id: 'user-2', displayName: 'Ada', isFollowing: false },
      { _id: 'user-3', displayName: 'Grace', isFollowing: false },
    ],
  });
});

test('ToggleFollowUseCase preserves missing authentication and self-follow guards', async () => {
  const useCase = new ToggleFollowUseCase({
    profileSocialGateway: {},
  });

  assert.deepEqual(await useCase.execute(new ToggleFollowDto({
    userId: 'user-2',
  })), {
    statusCode: 401,
    body: {
      message: 'Authentication required',
    },
  });

  assert.deepEqual(await useCase.execute(new ToggleFollowDto({
    userId: 'user-1',
    currentUserId: { toString: () => 'user-1' },
  })), {
    statusCode: 400,
    body: {
      message: 'You cannot follow yourself',
    },
  });
});

test('ToggleFollowUseCase deletes existing follow and returns legacy unfollow response', async () => {
  const calls = [];
  const existingFollow = { _id: 'follow-1' };
  const useCase = new ToggleFollowUseCase({
    profileSocialGateway: {
      async findFollow(query) {
        calls.push(['find', query]);
        return existingFollow;
      },
      async deleteFollow(follow) {
        calls.push(['delete', follow]);
      },
      async createFollow() {
        throw new Error('should not create follow');
      },
    },
  });

  const result = await useCase.execute(ToggleFollowDto.fromRequest({
    userId: 'user-1',
    params: { userId: 'user-2' },
    body: { currentUserId: 'ignored' },
  }));

  assert.deepEqual(calls, [
    ['find', {
      follower: 'user-1',
      following: 'user-2',
    }],
    ['delete', existingFollow],
  ]);
  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      followed: false,
    },
  });
});

test('ToggleFollowUseCase creates missing follow and returns legacy follow response', async () => {
  const calls = [];
  const useCase = new ToggleFollowUseCase({
    profileSocialGateway: {
      async findFollow(query) {
        calls.push(['find', query]);
        return null;
      },
      async deleteFollow() {
        throw new Error('should not delete follow');
      },
      async createFollow(command) {
        calls.push(['create', command]);
      },
    },
  });

  const result = await useCase.execute(ToggleFollowDto.fromRequest({
    user: { _id: 'user-1' },
    params: { userId: 'user-2' },
    body: { currentUserId: 'ignored' },
  }));

  assert.deepEqual(calls, [
    ['find', {
      follower: 'user-1',
      following: 'user-2',
    }],
    ['create', {
      follower: 'user-1',
      following: 'user-2',
    }],
  ]);
  assert.deepEqual(result, {
    statusCode: 200,
    body: {
      followed: true,
    },
  });
});

test('Profile social use cases let gateway errors propagate to controller failure paths', async () => {
  const useCase = new GetUserPostsUseCase({
    profileSocialGateway: {
      async listUserPosts() {
        throw new Error('post query failed');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute(new GetUserPostsDto({ userId: 'user-1' })),
    /post query failed/,
  );
});
