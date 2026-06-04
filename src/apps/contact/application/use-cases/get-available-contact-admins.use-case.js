export class GetAvailableContactAdminsUseCase {
  constructor({ contactUserRepository }) {
    this.contactUserRepository = contactUserRepository;
  }

  async execute() {
    const admins = await this.contactUserRepository.findAvailableContactAdmins();

    return {
      success: true,
      data: admins,
    };
  }
}
