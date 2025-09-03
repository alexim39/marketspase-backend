export const userPasswordResetLinkEmailTemplate = (partner) => {
  const year = new Date().getFullYear();
  const formattedName = partner.name ? partner.name.split(' ') // Split the name into an array of words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize the first letter of each word
      .join(' ') // Join the words back into a single string
  : '';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <header style="text-align: center; padding: 10px; background-color: #f4f4f4;">
        <span style="font-family: sans-serif; font-size: 20px; font-weight: bold; color: #050111;">
          <img src="https://marketspase.com/img/logo.png" alt="MarketSpase Logo" style="height: 50px;" />
        </span>
      </header>

      <main style="padding: 20px;">

        <p>Hi <strong>${formattedName}</strong>,</p>

        <p>
          Kindly, use below link to reset your password.
        </p>

        <br>
        <div style="text-align: center;">
          <a href="https://platform.marketspase.com/change-password?token=${partner.resetToken}" style="padding: 10px 20px; background-color: #007BFF; color: white; text-decoration: none; border-radius: 5px; text-align: center; margin: 1em 0;">
            Reset Password
          </a>
        </div>

        <p>
          Let's build now to earn passively tomorrow.
        </p>

        <p>
          Best regards,
          <br>
          Alex Imenwo
          <br>
          <strong>MarketSpase Team</strong>
        </p>
      </main>

      <br>
      <footer style="text-align: center; padding: 20px; background-color: #f4f4f4; ; margin-top: 20px;">

        <p>© ${year} MarketSpase. All rights reserved.</p>
        <div>
          Your online business for passive income
        </div>

      </footer>

    </div>
  `;
};