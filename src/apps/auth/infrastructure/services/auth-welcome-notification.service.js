import { sendEmail } from "../../../../core/email.service.js";
import { adminWelcomeEmailTemplate } from "../../services/email/adminTemplate.js";
import { userWelcomeEmailTemplate } from "../../services/email/userWelcomeTemplate.js";

export class AuthWelcomeNotificationService {
  async sendNewUserNotifications(user) {
    try {
      const ownerEmails = ["schooltraz@gmail.com"];
      const ownerMessage = adminWelcomeEmailTemplate(user);
      const userMessage = userWelcomeEmailTemplate(user);

      await Promise.all([
        ...ownerEmails.map((email) => sendEmail(email, "New Sign Up", ownerMessage)),
        user.email ? sendEmail(user.email, "Welcome to MarketSpase", userMessage) : Promise.resolve(),
      ]);
    } catch (error) {
      console.error("Email delivery failed:", error);
    }
  }
}
