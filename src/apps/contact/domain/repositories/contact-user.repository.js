export class ContactUserRepository {
  async findById() {
    throw new Error("ContactUserRepository.findById must be implemented.");
  }

  async touchLastSeen() {
    throw new Error("ContactUserRepository.touchLastSeen must be implemented.");
  }

  async findContactUsersByIds() {
    throw new Error("ContactUserRepository.findContactUsersByIds must be implemented.");
  }

  async findAvailableContactAdmins() {
    throw new Error("ContactUserRepository.findAvailableContactAdmins must be implemented.");
  }

  async findContactAdminById() {
    throw new Error("ContactUserRepository.findContactAdminById must be implemented.");
  }
}
