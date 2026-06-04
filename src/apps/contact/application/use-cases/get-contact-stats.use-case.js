export class GetContactStatsUseCase {
  constructor({ contactRepository }) {
    this.contactRepository = contactRepository;
  }

  async execute() {
    const stats = await this.contactRepository.getStats();

    return {
      success: true,
      data: stats,
    };
  }
}
