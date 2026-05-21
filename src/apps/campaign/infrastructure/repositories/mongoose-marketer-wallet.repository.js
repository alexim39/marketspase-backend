import { UserModel } from "../../../user/models/user/index.js";

export class MongooseMarketerWalletRepository {
  async getMarketerBalance(userId, { session } = {}) {
    if (!userId) return null;
    const query = UserModel.findById(userId).select("wallets.marketer.balance");
    if (session) query.session(session);
    return query.lean();
  }
}

