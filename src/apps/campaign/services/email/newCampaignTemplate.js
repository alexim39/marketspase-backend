export const newCampaignEmailTemplate = (user, campaignCount) => {
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
  <title>New Campaigns Available - MarketSpase</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:Arial, sans-serif;color:#2d3748;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
    <div style="background:#673ab7;padding:30px 20px;text-align:center;">
      <img src="https://marketspase.com/img/email_logo.jpg" alt="MarketSpase Logo" style="height:60px;border-radius:50%;">
    </div>

    <div style="padding:30px 20px;">
      <h1 style="font-size:24px;font-weight:bold;color:#673ab7;margin:0 0 20px;">New Campaigns Available, ${formattedName}!</h1>

      <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">
        Great news. We found <strong>${campaignCount} new campaign(s)</strong> that match your profile, interests, and targeting preferences.
        These campaigns are ready for promoters who can drive quality clicks and real buyer attention across their channels.
      </p>

      <div style="background:#f0fff4;padding:20px;border-radius:8px;margin-bottom:24px;">
        <h3 style="font-size:18px;font-weight:600;color:#38a169;margin:0 0 16px;text-align:center;">Campaign Highlights</h3>

        <ul style="padding-left:0;list-style:none;margin:0;">
          <li style="margin-bottom:12px;padding-left:24px;position:relative;">
            <span style="position:absolute;left:0;color:#38a169;">&#10003;</span>
            <strong>Earn for verified clicks</strong> that successfully open the campaign destination
          </li>
          <li style="margin-bottom:12px;padding-left:24px;position:relative;">
            <span style="position:absolute;left:0;color:#38a169;">&#10003;</span>
            <strong>Get a unique promotion link</strong> for every campaign you accept
          </li>
          <li style="margin-bottom:12px;padding-left:24px;position:relative;">
            <span style="position:absolute;left:0;color:#38a169;">&#10003;</span>
            <strong>Track clicks and earnings in real time</strong> from your promotion dashboard
          </li>
          <li style="margin-bottom:0;padding-left:24px;position:relative;">
            <span style="position:absolute;left:0;color:#38a169;">&#10003;</span>
            <strong>Build your reputation</strong> to unlock stronger payouts and premium opportunities
          </li>
        </ul>
      </div>

      <h2 style="font-size:18px;font-weight:600;color:#1a202c;margin:30px 0 16px;">How to get started:</h2>

      <ol style="padding-left:20px;margin:0 0 30px;">
        <li style="margin-bottom:12px;"><strong>Browse available campaigns</strong> in your dashboard</li>
        <li style="margin-bottom:12px;"><strong>Accept a campaign</strong> that fits your audience</li>
        <li style="margin-bottom:12px;"><strong>Copy your unique promotion link</strong> and download the campaign creative</li>
        <li style="margin-bottom:12px;"><strong>Share it across your channels</strong> like WhatsApp, Instagram, TikTok, Facebook, or other communities</li>
        <li style="margin-bottom:12px;"><strong>Drive verified clicks</strong> to the marketer's landing page, website, or WhatsApp destination</li>
        <li style="margin-bottom:12px;"><strong>Watch your clicks and earnings</strong> update in real time</li>
        <li style="margin-bottom:0;"><strong>Keep promoting while the campaign is live</strong> until the budget is exhausted or the campaign closes</li>
      </ol>

      <div style="background:#fff5f5;border-left:4px solid #feb2b2;padding:16px;margin:24px 0;border-radius:4px;">
        <p style="font-size:14px;line-height:1.5;margin:0;color:#c53030;">
          <strong>Time-sensitive:</strong> Campaign slots and budgets move fast. The best opportunities usually go to promoters who act quickly and send quality traffic.
        </p>
      </div>

      <div style="text-align:center;margin:30px 0;">
        <a href="https://marketspase.com/dashboard/campaigns" style="display:inline-block;padding:14px 28px;background:#673ab7;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">View Available Campaigns</a>
      </div>

      <p style="font-size:15px;line-height:1.6;">
        Questions about a campaign or where to share it? Reach out at
        <a href="mailto:support@marketspase.com" style="color:#673ab7;text-decoration:none;">support@marketspase.com</a>
      </p>

      <p style="font-size:15px;margin-top:30px;">Happy promoting!<br><strong>The MarketSpase Team</strong></p>
    </div>

    <div style="background:#1a202c;color:#a0aec0;padding:25px 20px;text-align:center;font-size:13px;">
      <p style="margin:0 0 12px;">&copy; ${year} MarketSpase. All rights reserved.</p>
      <p style="font-style:italic;color:#cbd5e0;">"Powering multi-channel promotion and social commerce"</p>
      <p style="font-size:12px;margin-top:20px;color:#718096;">
        You're receiving this email because you're a registered promoter on MarketSpase.<br>
        <a href="#" style="color:#a0aec0;text-decoration:none;">Unsubscribe</a> |
        <a href="#" style="color:#a0aec0;text-decoration:none;">Manage Notification Preferences</a> |
        <a href="#" style="color:#a0aec0;text-decoration:none;">Privacy Policy</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
};
