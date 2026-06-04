import { GetProfileDto } from '../dto/profile-social-query.dto.js';
import {
  PROFILE_WINDOW_DAYS,
  compactSocialProfiles,
  isSummaryProfileView,
} from '../mappers/profile-detail.mapper.js';

export class GetProfileUseCase {
  constructor({ profileSocialGateway, now = () => Date.now() } = {}) {
    if (!profileSocialGateway) {
      throw new Error('profileSocialGateway is required');
    }

    this.profileSocialGateway = profileSocialGateway;
    this.now = now;
  }

  async execute(input) {
    const dto = input instanceof GetProfileDto ? input : new GetProfileDto(input);

    if (!this.profileSocialGateway.isValidObjectId(dto.userId)) {
      return {
        statusCode: 400,
        body: {
          message: 'Invalid user ID',
        },
      };
    }

    const summaryView = isSummaryProfileView(dto.view);
    const currentUserId = dto.currentUserId && (
      dto.currentUserId === dto.userId || this.profileSocialGateway.isValidObjectId(dto.currentUserId)
    )
      ? dto.currentUserId
      : null;

    const user = await this.profileSocialGateway.findProfileUser({
      userId: dto.userId,
      summaryView,
    });

    if (!user) {
      return {
        statusCode: 404,
        body: {
          message: 'User not found',
        },
      };
    }

    const sinceDate = new Date(this.now() - PROFILE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const {
      userObjectId,
      feedStats,
      followersCount,
      followingCount,
    } = await this.profileSocialGateway.getBaseProfileStats({
      userId: dto.userId,
      sinceDate,
    });
    const postsCount = feedStats.postsCount || 0;
    const totalLikes = feedStats.totalLikes || 0;
    const totalEngagements = totalLikes + (feedStats.totalComments || 0) + (feedStats.totalShares || 0);
    const isFollowing = currentUserId && currentUserId.toString() !== dto.userId
      ? await this.profileSocialGateway.isFollowingUser({
          follower: currentUserId,
          following: dto.userId,
        })
      : false;

    const professionalInfo = {
      ...(user.professionalInfo || {}),
      socialProfiles: compactSocialProfiles(user.professionalInfo?.socialProfiles),
    };
    const isOwnProfile = currentUserId?.toString() === dto.userId;

    if (summaryView) {
      return {
        statusCode: 200,
        body: {
          ...user,
          professionalInfo,
          postsCount,
          followersCount,
          followingCount,
          totalLikes,
          totalEngagements,
          socialMetrics: {
            totalEngagements,
            feedPosts: postsCount,
            feedComments: feedStats.totalComments || 0,
            feedShares: feedStats.totalShares || 0,
            feedSaves: feedStats.totalSaves || 0,
            forumThreads: 0,
            forumReplies: 0,
            forumLikes: 0,
            newFollowers30Days: 0,
            profileFollowers: followersCount,
            storeFollowers: 0,
            recentPosts30Days: feedStats.recentPosts || 0,
            recentThreads30Days: 0,
            recentReplies30Days: 0,
          },
          marketerProfile: null,
          promoterProfile: null,
          isFollowing,
          isOwnProfile,
        },
      };
    }

    const reputationSnapshot = await this.profileSocialGateway.refreshUserReputation({
      userObjectId,
      user,
    });
    const {
      newFollowersCount,
      threadStats,
      commentStats,
    } = await this.profileSocialGateway.getDetailedProfileSocialStats({
      userObjectId,
      userId: dto.userId,
      sinceDate,
    });
    const detailedTotalEngagements =
      totalEngagements +
      (threadStats.totalThreadLikes || 0) +
      (threadStats.totalThreadComments || 0) +
      (threadStats.totalThreadShares || 0) +
      (commentStats.totalCommentLikes || 0);

    const roleProfile = user.role === 'marketer'
      ? await this.profileSocialGateway.buildMarketerProfile({ userObjectId, user, sinceDate })
      : user.role === 'promoter'
        ? await this.profileSocialGateway.buildPromoterProfile({ userObjectId, sinceDate })
        : null;
    const marketerSocialBoost = roleProfile?.storeSummary?.totalStoreFollowers || 0;

    return {
      statusCode: 200,
      body: {
        ...user,
        rating: reputationSnapshot.rating,
        ratingCount: reputationSnapshot.ratingCount,
        professionalInfo,
        postsCount,
        followersCount,
        followingCount,
        totalLikes,
        totalEngagements: detailedTotalEngagements,
        socialMetrics: {
          totalEngagements: detailedTotalEngagements,
          feedPosts: postsCount,
          feedComments: feedStats.totalComments || 0,
          feedShares: feedStats.totalShares || 0,
          feedSaves: feedStats.totalSaves || 0,
          forumThreads: threadStats.threadCount || 0,
          forumReplies: commentStats.commentCount || 0,
          forumLikes: (threadStats.totalThreadLikes || 0) + (commentStats.totalCommentLikes || 0),
          newFollowers30Days: newFollowersCount,
          profileFollowers: followersCount,
          storeFollowers: marketerSocialBoost,
          recentPosts30Days: feedStats.recentPosts || 0,
          recentThreads30Days: threadStats.recentThreads || 0,
          recentReplies30Days: commentStats.recentComments || 0,
        },
        marketerProfile: user.role === 'marketer' ? roleProfile : null,
        promoterProfile: user.role === 'promoter' ? roleProfile : null,
        isFollowing,
        isOwnProfile,
      },
    };
  }
}
