// services/email/withdrawalSuccessfulTemplate.js
export const withdrawalSuccessfulTemplate = (userData) => {
  const year = new Date().getFullYear();
  const formattedName = userData.userName
    ? userData.userName.charAt(0).toUpperCase() + userData.userName.slice(1).toLowerCase()
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Withdrawal Successful - MarketSpase</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:Arial, sans-serif;color:#2d3748;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
    
    <div style="background:#673ab7;padding:30px 20px;text-align:center;">
      <img src="https://marketspase.com/img/logo.JPG" alt="MarketSpase Logo" style="height:36px;">
    </div>
    
    <div style="padding:30px 20px;">
      <h1 style="font-size:24px;font-weight:bold;color:#673ab7;margin:0 0 20px;">Withdrawal Successful! 🎉</h1>
      
      <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">Hello ${formattedName},</p>
      
      <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">Your withdrawal request has been processed successfully. The funds should reflect in your bank account within 24 hours.</p>

      <div style="background:#f0fff4;padding:20px;border-radius:8px;margin-bottom:24px;">
        <h3 style="font-size:16px;font-weight:600;color:#38a169;margin:0 0 12px;">💰 Transaction Details</h3>
        <table style="width:100%;font-size:14px;line-height:1.5;">
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Amount Withdrawn:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">₦${userData.amount.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Processing Fee:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">₦${userData.fee.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Bank Account:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">${userData.bankName} ••••${userData.accountNumber}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>New Balance:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">₦${userData.newBalance.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Date:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">${new Date().toLocaleDateString()}</td>
          </tr>
        </table>
      </div>

      <div style="background:#f7fafc;padding:16px;border-radius:8px;margin:24px 0;">
        <p style="font-size:14px;line-height:1.5;margin:0;color:#4a5568;">
          <strong>💡 Tip:</strong> Keep promoting campaigns to grow your earnings! Promoters with higher reliability scores get access to premium campaigns.
        </p>
      </div>

      <div style="text-align:center;margin:30px 0;">
        <a href="https://marketspase.com/dashboard/campaigns" style="display:inline-block;padding:14px 28px;background:#673ab7;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Browse Available Campaigns</a>
      </div>

      <p style="font-size:15px;line-height:1.6;">Questions about your withdrawal? Contact us at <a href="mailto:support@marketspase.com" style="color:#673ab7;text-decoration:none;">support@marketspase.com</a></p>

      <p style="font-size:15px;margin-top:30px;">Happy promoting!<br><strong>The MarketSpase Team</strong></p>
    </div>

    <div style="background:#1a202c;color:#a0aec0;padding:25px 20px;text-align:center;font-size:13px;">
      <p style="margin:0 0 12px;">© ${year} MarketSpase. All rights reserved.</p>
      <p style="font-style:italic;color:#cbd5e0;">"Where WhatsApp Status Turns into Income"</p>
      <p style="font-size:12px;margin-top:20px;color:#718096;">
        You're receiving this email because you're a registered promoter on MarketSpase.<br>
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