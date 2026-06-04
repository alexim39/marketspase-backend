const EMPTY_NEWSLETTER_STATS = {
  total: 0,
  draft: 0,
  scheduled: 0,
  sent: 0,
  totalSent: 0,
  avgOpenRate: 0,
  avgClickRate: 0,
};

export class GetNewsletterStatsUseCase {
  constructor({ newsletterRepository }) {
    this.newsletterRepository = newsletterRepository;
  }

  async execute() {
    const stats = await this.newsletterRepository.getStats();

    return {
      success: true,
      data: stats[0] || { ...EMPTY_NEWSLETTER_STATS },
      message: "Newsletter statistics retrieved successfully",
    };
  }
}
