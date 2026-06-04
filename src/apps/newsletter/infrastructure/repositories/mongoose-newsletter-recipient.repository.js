import { UserModel } from "../../../user/models/user/index.js";

const ACTIVE_USER_FILTER = {
  isActive: true,
  isDeleted: false,
};

export class MongooseNewsletterRecipientRepository {
  async countActiveUsers() {
    return UserModel.countDocuments(ACTIVE_USER_FILTER);
  }

  async countActiveUsersByRole(role) {
    return UserModel.countDocuments({
      role,
      ...ACTIVE_USER_FILTER,
    });
  }

  async findRecipients(recipientType, externalEmails = []) {
    try {
      switch (recipientType) {
        case "all":
          return UserModel.find({
            ...ACTIVE_USER_FILTER,
            email: { $exists: true, $ne: null },
          }).select("email displayName role");

        case "marketers":
          return UserModel.find({
            role: "marketer",
            ...ACTIVE_USER_FILTER,
            email: { $exists: true, $ne: null },
          }).select("email displayName role");

        case "promoters":
          return UserModel.find({
            role: "promoter",
            ...ACTIVE_USER_FILTER,
            email: { $exists: true, $ne: null },
          }).select("email displayName role");

        case "external":
          return externalEmails.map((email) => ({
            email,
            displayName: "",
            role: "external",
          }));

        default:
          return [];
      }
    } catch (error) {
      console.error("Error in findRecipients repository:", error);
      return [];
    }
  }
}
