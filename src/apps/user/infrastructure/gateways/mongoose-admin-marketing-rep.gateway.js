import { UserModel } from '../../models/user/index.js';
import { AdminMarketingRepGateway } from '../../application/ports/admin-marketing-rep.gateway.js';

export class MongooseAdminMarketingRepGateway extends AdminMarketingRepGateway {
  constructor({ userModel = UserModel } = {}) {
    super();
    this.userModel = userModel;
  }

  async updateMarketingRepStatus({ userId, updateData } = {}) {
    return this.userModel.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );
  }
}
