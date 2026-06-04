export class ProfessionalProfileGateway {
  isValidObjectId(_value) {
    throw new Error('ProfessionalProfileGateway.isValidObjectId must be implemented');
  }

  async updateProfessionalProfile(_command = {}) {
    throw new Error('ProfessionalProfileGateway.updateProfessionalProfile must be implemented');
  }

  async logProfessionalProfileUpdate(_command = {}) {
    throw new Error('ProfessionalProfileGateway.logProfessionalProfileUpdate must be implemented');
  }
}
