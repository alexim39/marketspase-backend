import test from 'node:test';
import assert from 'node:assert/strict';

import {
  diversifyRankedPosts,
  isEligibleFeedPost,
  scoreFeedPost,
  shapeFeedPost,
} from '../services/feed-discovery.service.js';

const activeAuthor = {
  _id: 'author-1',
  username: 'creator',
  displayName: 'Creator',
  avatar: 'avatar.png',
  role: 'promoter',
  rating: 4.5,
  isVerified: true,
  isActive: true,
  isDeleted: false,
  personalInfo: { phone: '2348012345678' },
  fraudProfile: {
    trustScore: 92,
    riskLevel: 'low',
  },
};

const basePost = {
  _id: 'post-1',
  author: activeAuthor,
  content: 'Useful business update',
  status: 'published',
  type: 'story',
  source: 'manual',
  moderation: { isFlagged: false },
  likes: [],
  comments: [],
  shares: [],
  savedBy: [],
  media: [],
  createdAt: new Date().toISOString(),
};

test('isEligibleFeedPost blocks unsafe creators and unavailable business content', () => {
  assert.equal(isEligibleFeedPost(basePost), true);

  assert.equal(isEligibleFeedPost({
    ...basePost,
    author: {
      ...activeAuthor,
      fraudProfile: { riskLevel: 'critical', trustScore: 5 },
    },
  }), false);

  assert.equal(isEligibleFeedPost({
    ...basePost,
    type: 'campaign',
    source: 'campaign',
    campaign: { status: 'expired' },
  }), false);

  assert.equal(isEligibleFeedPost({
    ...basePost,
    type: 'product',
    source: 'product',
    product: {
      productId: { _id: 'product-1', isActive: false, isDeleted: false, isPublished: true },
      storeId: { _id: 'store-1', isActive: true, isDeleted: false },
    },
  }), false);
});

test('scoreFeedPost adds role and business relevance for promoter feeds', () => {
  const promoterSignals = {
    userId: 'promoter-1',
    viewerRole: 'promoter',
    followingIds: new Set(),
    authorAffinity: new Map(),
    hashtagAffinity: new Map(),
    categoryAffinity: new Map(),
    typeAffinity: new Map(),
  };

  const campaignPost = {
    ...basePost,
    _id: 'campaign-post',
    type: 'campaign',
    source: 'campaign',
    campaign: {
      status: 'active',
      campaignId: {
        _id: 'campaign-1',
        status: 'active',
        totalClicks: 100,
        billableClicks: 90,
      },
    },
  };

  assert.ok(
    scoreFeedPost(campaignPost, promoterSignals, 'for_you') > scoreFeedPost(basePost, promoterSignals, 'for_you')
  );
});

test('diversifyRankedPosts reduces consecutive creator repetition', () => {
  const ranked = diversifyRankedPosts([
    { _id: 'a-1', author: { _id: 'author-a' }, type: 'story', recommendationScore: 100 },
    { _id: 'a-2', author: { _id: 'author-a' }, type: 'story', recommendationScore: 99 },
    { _id: 'b-1', author: { _id: 'author-b' }, type: 'product', recommendationScore: 98 },
  ]);

  assert.deepEqual(ranked.map((post) => post._id), ['a-1', 'b-1', 'a-2']);
});

test('shapeFeedPost keeps trust fields backend-only while preserving public author data', () => {
  const shaped = shapeFeedPost(basePost, 'viewer-1');

  assert.equal(shaped.author.displayName, 'Creator');
  assert.equal(shaped.phone, '2348012345678');
  assert.equal('fraudProfile' in shaped.author, false);
  assert.equal('isDeleted' in shaped.author, false);
});
