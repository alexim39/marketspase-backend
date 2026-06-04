export class GetRecipientCountsUseCase {
  constructor({ recipientRepository }) {
    this.recipientRepository = recipientRepository;
  }

  async execute() {
    const [allUsers, marketers, promoters] = await Promise.all([
      this.recipientRepository.countActiveUsers(),
      this.recipientRepository.countActiveUsersByRole("marketer"),
      this.recipientRepository.countActiveUsersByRole("promoter"),
    ]);

    return {
      success: true,
      data: {
        all: allUsers,
        marketers,
        promoters,
      },
      message: "Recipient counts retrieved successfully",
    };
  }
}
