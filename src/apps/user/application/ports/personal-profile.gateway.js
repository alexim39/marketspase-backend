export class PersonalProfileGateway {
  isValidObjectId(_value) {
    throw new Error('PersonalProfileGateway.isValidObjectId must be implemented');
  }

  async findUserById(_userId) {
    throw new Error('PersonalProfileGateway.findUserById must be implemented');
  }

  async findUserByEmail(_query = {}) {
    throw new Error('PersonalProfileGateway.findUserByEmail must be implemented');
  }

  async findUserByPhone(_query = {}) {
    throw new Error('PersonalProfileGateway.findUserByPhone must be implemented');
  }

  async updatePersonalProfile(_command = {}) {
    throw new Error('PersonalProfileGateway.updatePersonalProfile must be implemented');
  }

  async logPersonalProfileUpdate(_command = {}) {
    throw new Error('PersonalProfileGateway.logPersonalProfileUpdate must be implemented');
  }
}
