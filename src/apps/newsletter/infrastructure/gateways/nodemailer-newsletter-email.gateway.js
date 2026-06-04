import { sendEmail } from "../../../../core/email.service.js";
import { newsletterEmailTemplate } from "../../services/email/newsletter.template.js";

export class NodemailerNewsletterEmailGateway {
  async sendNewsletter({ newsletter, recipient }) {
    const trackingPixelUrl = `${process.env.API_URL}/newsletters/track/open/${newsletter._id}/${recipient.email}`;
    const unsubscribeUrl = `${process.env.FRONTEND_URL}/unsubscribe?email=${recipient.email}&newsletter=${newsletter._id}`;
    const htmlContent = newsletterEmailTemplate(
      newsletter,
      recipient,
      trackingPixelUrl,
      unsubscribeUrl,
    );

    await sendEmail(
      recipient.email,
      newsletter.subject,
      htmlContent,
    );
  }
}
