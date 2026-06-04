export class UsernameGateway {
  async updateUsername(_command = {}) {
    throw new Error('UsernameGateway.updateUsername must be implemented');
  }

  async logUsernameUpdate(_command = {}) {
    throw new Error('UsernameGateway.logUsernameUpdate must be implemented');
  }
}
