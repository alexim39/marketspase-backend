import { NewsletterActionRejectedError } from "../../domain/errors/newsletter.errors.js";
import { SendNewsletterDto } from "../dto/send-newsletter.dto.js";

export class SendNewsletterUseCase {
  constructor({ newsletterRepository, recipientRepository, emailGateway }) {
    this.newsletterRepository = newsletterRepository;
    this.recipientRepository = recipientRepository;
    this.emailGateway = emailGateway;
  }

  async execute(input) {
    const dto = input instanceof SendNewsletterDto
      ? input
      : new SendNewsletterDto(input);

    try {
      const newsletter = await this.newsletterRepository.findById(dto.id);

      if (!newsletter) {
        throw new NewsletterActionRejectedError("Newsletter not found");
      }

      if (newsletter.status === "sent") {
        throw new NewsletterActionRejectedError("Newsletter has already been sent");
      }

      const recipients = await this.recipientRepository.findRecipients(
        newsletter.recipientType,
        newsletter.externalEmails,
      );

      if (recipients.length === 0) {
        throw new NewsletterActionRejectedError("No recipients found for this newsletter");
      }

      const sendingNewsletter = await this.newsletterRepository.markSendingById(
        dto.id,
        recipients.length,
      );

      if (!sendingNewsletter) {
        throw new Error("Newsletter not found while marking as sending");
      }

      await Promise.all(
        recipients.map((recipient) => this.sendToRecipient({
          newsletterId: dto.id,
          newsletter: sendingNewsletter,
          recipient,
        })),
      );

      const sentNewsletter = await this.newsletterRepository.markSentById(
        dto.id,
        recipients.length,
      );

      return {
        success: true,
        data: sentNewsletter,
        message: "Newsletter sent successfully",
      };
    } catch (error) {
      if (error instanceof NewsletterActionRejectedError) {
        throw error;
      }

      await this.newsletterRepository.markFailedById(dto.id);
      throw new NewsletterActionRejectedError("Failed to send newsletter");
    }
  }

  async sendToRecipient({ newsletterId, newsletter, recipient }) {
    try {
      await this.emailGateway.sendNewsletter({ newsletter, recipient });
      await this.newsletterRepository.addDeliveryStatusById(newsletterId, {
        email: recipient.email,
        status: "sent",
        deliveredAt: new Date(),
        serviceProvider: "sendgrid",
      });
    } catch (error) {
      await this.newsletterRepository.addDeliveryStatusById(newsletterId, {
        email: recipient.email,
        status: "failed",
        failureReason: error.message,
        serviceProvider: "sendgrid",
      });
    }
  }
}
