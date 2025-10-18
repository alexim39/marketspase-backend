// services/email/withdrawalFailedTemplate.js
export const withdrawalFailedTemplate = (userData) => {
  const year = new Date().getFullYear();
  const formattedName = userData.userName
    ? userData.userName.charAt(0).toUpperCase() + userData.userName.slice(1).toLowerCase()
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Withdrawal Failed - MarketSpase</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:Arial, sans-serif;color:#2d3748;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
    
    <div style="background:#673ab7;padding:30px 20px;text-align:center;">
       <img src="https://marketspase.com/img/email_logo.jpg" alt="MarketSpase Logo" style="height:60px;">
    </div>
    
    <div style="padding:30px 20px;">
      <h1 style="font-size:24px;font-weight:bold;color:#673ab7;margin:0 0 20px;">Withdrawal Failed</h1>
      
      <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">Hello ${formattedName},</p>
      
      <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">We were unable to process your withdrawal request. Don't worry - your funds have been refunded to your wallet.</p>

      <div style="background:#fed7d7;padding:20px;border-radius:8px;margin-bottom:24px;">
        <h3 style="font-size:16px;font-weight:600;color:#c53030;margin:0 0 12px;">⚠️ Transaction Details</h3>
        <table style="width:100%;font-size:14px;line-height:1.5;">
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Amount:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">₦${userData.amount.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Bank Account:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">${userData.bankName} ••••${userData.accountNumber}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Reason:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">${userData.reason}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Refunded Amount:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">₦${userData.refundedAmount.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Current Balance:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">₦${userData.newBalance.toLocaleString()}</td>
          </tr>
        </table>
      </div>

      <div style="background:#f7fafc;padding:20px;border-radius:8px;margin-bottom:24px;">
        <h3 style="font-size:16px;font-weight:600;color:#2d3748;margin:0 0 12px;">💡 What to do next:</h3>
        <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.5;">
          <li>Check your bank account details</li>
          <li>Ensure your account is active and can receive transfers</li>
          <li>Verify your account name matches your bank records</li>
          <li>Try again with a different bank account if issues persist</li>
        </ul>
      </div>

      <div style="text-align:center;margin:30px 0;">
        <a href="https://marketspase.com/dashboard/wallet" style="display:inline-block;padding:14px 28px;background:#673ab7;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Try Withdrawal Again</a>
      </div>

      <p style="font-size:15px;line-height:1.6;">If you need assistance, contact our support team at <a href="mailto:support@marketspase.com" style="color:#673ab7;text-decoration:none;">support@marketspase.com</a></p>

      <p style="font-size:15px;margin-top:30px;">Best regards,<br><strong>The MarketSpase Team</strong></p>
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