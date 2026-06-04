import { UserModel } from "../../../user/models/user/index.js";

export class MongooseContactUserRepository {
  async findById(userId) {
    return UserModel.findById(userId);
  }

  async touchLastSeen(userId) {
    return UserModel.updateOne(
      { _id: userId },
      { $set: { lastSeenAt: new Date() } },
    );
  }

  async findContactUsersByIds(userIds) {
    return UserModel.find({ _id: { $in: userIds } })
      .select("username displayName avatar email")
      .lean();
  }

  async findAvailableContactAdmins() {
    return UserModel.find({
      role: { $in: ["admin", "marketing_rep"] },
      isActive: true,
      isDeleted: false,
    })
      .select("username displayName avatar")
      .sort({ displayName: 1 });
  }

  async findContactAdminById(adminId) {
    return UserModel.findById(adminId);
  }
}
