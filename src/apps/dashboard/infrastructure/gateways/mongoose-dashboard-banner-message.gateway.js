import { BannerMessageModel, UserDismissalModel } from '../../models/banner-message/index.js';
import { resolveBannerAudienceScope, TARGET_AUDIENCE } from '../../domain/banner-message/banner-message-audience.policy.js';
import { DashboardBannerMessageGateway } from '../../application/ports/dashboard-banner-message.gateway.js';

export class MongooseDashboardBannerMessageGateway extends DashboardBannerMessageGateway {
  async getActiveBannerMessages({ userId, isNewUser = false, groups = [], now = new Date() } = {}) {
    const userDismissal = userId ? await UserDismissalModel.findOne({ userId }) : null;
    const dismissedIds = userDismissal?.dismissedNotifications || [];
    const audienceScope = resolveBannerAudienceScope({ userId, isNewUser, groups });

    const orConditions = audienceScope.audiences.map((targetAudience) => ({ targetAudience }));

    if (audienceScope.groups.length > 0) {
      orConditions.push({
        targetAudience: TARGET_AUDIENCE.SPECIFIC_GROUP,
        specificUserGroups: { $in: audienceScope.groups },
      });
    }

    return BannerMessageModel.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      showBanner: true,
      _id: { $nin: dismissedIds },
      $or: orConditions,
    })
      .sort({ priority: -1, createdAt: -1 })
      .select('-__v')
      .lean();
  }

  async getDismissedBannerMessageIds(userId) {
    const userDismissal = await UserDismissalModel.findOne({ userId });
    return userDismissal?.dismissedNotifications || [];
  }

  async findBannerMessageById(id) {
    return BannerMessageModel.findById(id);
  }

  async dismissBannerMessage({ userId, notificationId } = {}) {
    return UserDismissalModel.findOneAndUpdate(
      { userId },
      { $addToSet: { dismissedNotifications: notificationId } },
      { upsert: true, new: true },
    );
  }

  async createBannerMessage(data = {}) {
    const notification = new BannerMessageModel(data);
    await notification.save();
    return notification;
  }

  async updateBannerMessage({ id, data = {} } = {}) {
    return BannerMessageModel.findByIdAndUpdate(
      id,
      data,
      { new: true, runValidators: true },
    );
  }

  async deleteBannerMessage(id) {
    return BannerMessageModel.findByIdAndDelete(id);
  }
}
