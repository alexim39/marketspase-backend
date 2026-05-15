export const campaignRejectedTemplate = (campaignData) => {
  const year = new Date().getFullYear();
  const formattedName = campaignData.userName
    ? campaignData.userName
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Campaign Not Approved - MarketSpase</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:Arial, sans-serif;color:#2d3748;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
    <div style="background:#673ab7;padding:30px 20px;text-align:center;">
      <img src="https://marketspase.com/img/email_logo.jpg" alt="MarketSpase Logo" style="height:60px;border-radius:50%;">
    </div>

    <div style="padding:30px 20px;">
      <h1 style="font-size:24px;font-weight:bold;color:#673ab7;margin:0 0 20px;">Campaign Update</h1>

      <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">Hello ${formattedName},</p>

      <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">
        After review, we could not approve this campaign yet. Your campaign budget has been returned to your available wallet balance, so you can revise the setup and submit again when ready.
      </p>

      <div style="background:#fed7d7;padding:20px;border-radius:8px;margin-bottom:24px;">
        <h3 style="font-size:16px;font-weight:600;color:#c53030;margin:0 0 12px;">Campaign Details</h3>
        <table style="width:100%;font-size:14px;line-height:1.5;">
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Campaign Title:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">${campaignData.campaignTitle}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Budget:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">N${campaignData.budget.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Status:</strong></td>
            <td style="padding:8px 0;color:#c53030;text-align:right;font-weight:bold;">REJECTED</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Refund Amount:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">N${campaignData.refundAmount.toLocaleString()}</td>
          </tr>
        </table>
      </div>

      ${campaignData.rejectionReason ? `
      <div style="background:#fffaf0;padding:16px;border-radius:8px;margin:16px 0;">
        <h4 style="font-size:14px;font-weight:600;color:#dd6b20;margin:0 0 8px;">Reason for Rejection:</h4>
        <p style="font-size:14px;line-height:1.5;margin:0;color:#744210;">${campaignData.rejectionReason}</p>
      </div>
      ` : ''}

      <div style="background:#f7fafc;padding:20px;border-radius:8px;margin-bottom:24px;">
        <h3 style="font-size:16px;font-weight:600;color:#2d3748;margin:0 0 12px;">What to do next:</h3>
        <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.5;">
          <li>Review our <a href="https://marketspase.com/guidelines" style="color:#673ab7;text-decoration:none;">campaign guidelines</a></li>
          <li>Update your creative, destination link, or targeting based on the feedback</li>
          <li>Check that the campaign offer and landing experience are clear for promoters and end users</li>
          <li>Resubmit the campaign when everything is ready</li>
        </ul>
      </div>

      <div style="text-align:center;margin:30px 0;">
        <a href="https://marketspase.com/dashboard/campaigns/create" style="display:inline-block;padding:14px 28px;background:#673ab7;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Create New Campaign</a>
      </div>

      <p style="font-size:15px;line-height:1.6;">
        Need help? Our support team is here to assist you at
        <a href="mailto:support@marketspase.com" style="color:#673ab7;text-decoration:none;">support@marketspase.com</a>
      </p>

      <p style="font-size:15px;margin-top:30px;">Best regards,<br><strong>The MarketSpase Team</strong></p>
    </div>

    <div style="background:#1a202c;color:#a0aec0;padding:25px 20px;text-align:center;font-size:13px;">
      <p style="margin:0 0 12px;">&copy; ${year} MarketSpase. All rights reserved.</p>
      <p style="font-style:italic;color:#cbd5e0;">"Powering multi-channel promotion and social commerce"</p>
      <p style="font-size:12px;margin-top:20px;color:#718096;">
        You're receiving this email because you're a registered marketer on MarketSpase.<br>
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
