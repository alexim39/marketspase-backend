export class PublicIdentityGateway {
  async findExistingUsername(_query = {}) {
    throw new Error('PublicIdentityGateway.findExistingUsername must be implemented');
  }

  async updatePublicIdentity(_command = {}) {
    throw new Error('PublicIdentityGateway.updatePublicIdentity must be implemented');
  }

  async logPublicIdentityUpdate(_command = {}) {
    throw new Error('PublicIdentityGateway.logPublicIdentityUpdate must be implemented');
  }
}
