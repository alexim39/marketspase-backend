import test from 'node:test';
import assert from 'node:assert/strict';

import { GetAdminOverviewStatsUseCase } from '../application/use-cases/get-admin-overview-stats.use-case.js';
import { GetCampaignStatsUseCase } from '../application/use-cases/get-campaign-stats.use-case.js';
import { GetEngagementStatsUseCase } from '../application/use-cases/get-engagement-stats.use-case.js';
import { GetRevenueStatsUseCase } from '../application/use-cases/get-revenue-stats.use-case.js';
import { GetUserStatsUseCase } from '../application/use-cases/get-user-stats.use-case.js';

test('Dashboard stats use cases preserve raw aggregate arrays for route wrappers', async () => {
  const campaignStats = [{
    totalCampaigns: 10,
    activeCampaigns: 4,
    pendingCampaigns: 3,
    completedCampaigns: 3,
  }];
  const userStats = [{
    totalUsers: 25,
    activeUsers: 19,
    usersChange: 8.5,
  }];
  const revenueStats = [{
    totalRevenue: 250000,
    currentMonthRevenue: 80000,
    previousMonthRevenue: 60000,
    revenueChange: 33.3333,
  }];
  const engagementStats = [{
    averageEngagement: 75.5,
    engagementChange: 12.3,
    currentWeekEngagement: 78.2,
    previousWeekEngagement: 69.6,
  }];

  const gateway = {
    async getCampaignStats() {
      return campaignStats;
    },
    async getUserStats() {
      return userStats;
    },
    async getRevenueStats() {
      return revenueStats;
    },
    async getEngagementStats() {
      return engagementStats;
    },
  };

  assert.deepEqual(await new GetCampaignStatsUseCase({ dashboardStatsGateway: gateway }).execute(), campaignStats);
  assert.deepEqual(await new GetUserStatsUseCase({ dashboardStatsGateway: gateway }).execute(), userStats);
  assert.deepEqual(await new GetRevenueStatsUseCase({ dashboardStatsGateway: gateway }).execute(), revenueStats);
  assert.deepEqual(await new GetEngagementStatsUseCase({ dashboardStatsGateway: gateway }).execute(), engagementStats);
});

test('GetAdminOverviewStatsUseCase preserves overview object shape', async () => {
  const overview = {
    users: {
      totalUsers: 100,
      marketers: 40,
      promoters: 60,
      activeUsers: 70,
    },
    ads: {
      totalCampaigns: 12,
      activeCampaigns: 5,
      pendingCampaigns: 2,
      totalPromotions: 50,
      submittedPromotions: 6,
      totalCampaignClicks: 1000,
    },
    commerce: {
      totalStores: 8,
      totalProducts: 30,
      paidOrders: 14,
      grossMerchandiseValue: 540000,
    },
    community: {
      totalFeedPosts: 90,
      totalThreads: 11,
      feedPosts24h: 4,
      forumThreads24h: 2,
    },
    rewards: {
      activeStreakUsers: 9,
      badgeAwards: 20,
      leveledUsers: 7,
    },
  };

  const useCase = new GetAdminOverviewStatsUseCase({
    dashboardStatsGateway: {
      async getAdminOverviewStats() {
        return overview;
      },
    },
  });

  assert.deepEqual(await useCase.execute(), overview);
});

test('Dashboard stats use cases let gateway errors propagate to route/controller failure paths', async () => {
  const failingGateway = {
    async getCampaignStats() {
      throw new Error('stats unavailable');
    },
  };

  await assert.rejects(
    () => new GetCampaignStatsUseCase({ dashboardStatsGateway: failingGateway }).execute(),
    /stats unavailable/,
  );
});
