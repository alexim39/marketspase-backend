export class NewsletterRecipientRepository {
  async countActiveUsers() {
    throw new Error("NewsletterRecipientRepository.countActiveUsers must be implemented.");
  }

  async countActiveUsersByRole() {
    throw new Error("NewsletterRecipientRepository.countActiveUsersByRole must be implemented.");
  }

  async findRecipients() {
    throw new Error("NewsletterRecipientRepository.findRecipients must be implemented.");
  }
}
