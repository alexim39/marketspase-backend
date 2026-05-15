export const userWelcomeEmailTemplate = (user) => {
  const year = new Date().getFullYear();
  const formattedName = user.displayName
    ? user.displayName
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Welcome to MarketSpase</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:Arial, sans-serif;color:#2d3748;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
    <div style="background:#673ab7;padding:30px 20px;text-align:center;">
      <img src="https://marketspase.com/img/email_logo.jpg" alt="MarketSpase Logo" style="height:60px;border-radius:50%;">
    </div>

    <div style="padding:30px 20px;">
      <h1 style="font-size:24px;font-weight:bold;color:#673ab7;margin:0 0 20px;">Welcome to MarketSpase, ${formattedName}!</h1>

      <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">
        You've joined a multi-channel digital marketing platform built for marketers, promoters, and storefront growth.
        Whether you want to launch click-based campaigns, promote products, or earn from the traffic you generate, MarketSpase keeps the workflow simple and trackable.
      </p>

      <h2 style="font-size:18px;font-weight:600;color:#1a202c;margin:30px 0 16px;">Here's how MarketSpase works:</h2>

      <div style="background:#f7fafc;padding:20px;border-radius:8px;margin-bottom:24px;">
        <h3 style="font-size:16px;font-weight:600;color:#673ab7;margin:0 0 12px;">For Marketers:</h3>
        <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.5;">
          <li>Create ad campaigns or promote products from your storefront</li>
          <li>Set your destination link, budget, and targeting preferences</li>
          <li>Track clicks, promoter activity, and spend in real time</li>
          <li>Pay for verified traffic and measurable results instead of vague reach estimates</li>
        </ul>
      </div>

      <div style="background:#f0fff4;padding:20px;border-radius:8px;margin-bottom:24px;">
        <h3 style="font-size:16px;font-weight:600;color:#38a169;margin:0 0 12px;">For Promoters:</h3>
        <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.5;">
          <li>Browse live campaigns and promoted products that match your audience</li>
          <li>Accept campaigns to generate your unique promotion link</li>
          <li>Share across WhatsApp, Instagram, TikTok, Facebook, and other channels</li>
          <li>Earn when verified clicks land successfully on the marketer's destination</li>
        </ul>
      </div>

      <h2 style="font-size:18px;font-weight:600;color:#1a202c;margin:30px 0 16px;">Key features you'll love:</h2>

      <ul style="padding-left:0;list-style:none;margin:0 0 30px;">
        <li style="margin-bottom:12px;"><strong>Secure payments:</strong> Wallet and settlement controls protect both marketers and promoters</li>
        <li style="margin-bottom:12px;"><strong>Real-time click tracking:</strong> Campaign links measure performance as traffic comes in</li>
        <li style="margin-bottom:12px;"><strong>Storefront + affiliate support:</strong> Sell products and reward promoters from the same platform</li>
        <li style="margin-bottom:12px;"><strong>Mobile-first experience:</strong> Built for fast action from mobile and desktop</li>
        <li style="margin-bottom:12px;"><strong>Targeted reach:</strong> Match the right campaigns to the right promoters for better results</li>
      </ul>

      <p style="font-size:16px;line-height:1.6;margin-bottom:24px;">
        Ready to get started? Complete your profile, set your preferences, and explore the campaigns or storefront tools that match your role.
      </p>

      <div style="text-align:center;margin:30px 0;">
        <a href="https://marketspase.com/dashboard" style="display:inline-block;padding:14px 28px;background:#673ab7;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Go to Dashboard</a>
      </div>

      <div style="background:#fff5f5;border-left:4px solid #feb2b2;padding:16px;margin:24px 0;border-radius:4px;">
        <p style="font-size:14px;line-height:1.5;margin:0;color:#c53030;">
          <strong>Pro Tip:</strong> Promoters who send quality traffic and marketers who use clear landing pages usually unlock stronger campaign performance and better matches.
        </p>
      </div>

      <div style="background:#fffaf0;border-left:4px solid #f6ad55;padding:16px;margin:12px 0 24px;border-radius:4px;">
        <p style="font-size:14px;line-height:1.5;margin:0;color:#744210;">
          <strong>Important:</strong> Creating multiple accounts is against MarketSpase policy. Users found to have more than one account may face suspension of all linked accounts.
          If you believe there is a legitimate need for multiple accounts, please contact
          <a href="mailto:contact@marketspase.com" style="color:#673ab7;text-decoration:none;">support</a>
          before registering another account.
        </p>
      </div>

      <p style="font-size:15px;line-height:1.6;">
        Questions? Check our <a href="https://marketspase.com/resources/faqs" style="color:#673ab7;font-weight:600;text-decoration:none;">FAQ</a>
        or reach out at <a href="mailto:contact@marketspase.com" style="color:#673ab7;text-decoration:none;">contact@marketspase.com</a>
      </p>

      <p style="font-size:15px;margin-top:30px;">Welcome aboard!<br><strong>The MarketSpase Team</strong></p>
    </div>

    <div style="background:#1a202c;color:#a0aec0;padding:25px 20px;text-align:center;font-size:13px;">
      <p style="margin:0 0 12px;">&copy; ${year} MarketSpase. All rights reserved.</p>
      <p style="font-style:italic;color:#cbd5e0;">"Powering multi-channel promotion and social commerce"</p>
      <p style="font-size:12px;margin-top:20px;color:#718096;">
        You're receiving this email because you signed up for MarketSpase.<br>
        <a href="#" style="color:#a0aec0;text-decoration:none;">Unsubscribe</a> |
        <a href="#" style="color:#a0aec0;text-decoration:none;">Manage Preferences</a> |
        <a href="#" style="color:#a0aec0;text-decoration:none;">Privacy Policy</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
};
