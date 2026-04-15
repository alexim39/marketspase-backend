export const transferNotificationEmailTemplate = (data) => {
  const year = new Date().getFullYear();
  const {
    userName,
    transferType,      // 'self' or 'other'
    transactionType,   // 'debit' or 'credit'
    amount,
    reference,
    otherPartyName,
    destinationWalletType,
    marketerLocked,
    note,
    newBalance
  } = data;

  const isSelfTransfer = transferType === 'self';
  const isDebit = transactionType === 'debit';

  let title = '';
  let headerColor = '';
  let mainMessage = '';
  let actionText = '';

  if (isSelfTransfer) {
    // Self transfer to own marketer wallet
    if (isDebit) {
      title = 'Transfer to Marketer Wallet';
      headerColor = '#673ab7';
      mainMessage = `You have successfully transferred ₦${amount.toLocaleString()} from your Promoter Wallet to your Marketer Wallet.`;
      actionText = 'These funds are now available for marketing campaigns.';
    } else {
      title = 'Transfer from Promoter Wallet';
      headerColor = '#38a169';
      mainMessage = `Your Marketer Wallet has been credited with ₦${amount.toLocaleString()} from your Promoter Wallet.`;
      actionText = 'These funds are ready to use for your marketing campaigns.';
    }
  } else {
    // Transfer to another user
    if (isDebit) {
      title = 'Funds Sent Successfully';
      headerColor = '#e53e3e';
      mainMessage = `You have successfully sent ₦${amount.toLocaleString()} to ${otherPartyName}'s ${destinationWalletType} wallet.`;
      actionText = marketerLocked 
        ? 'Note: Funds sent to a Marketer wallet are locked for in-app use only and cannot be withdrawn.'
        : 'The recipient can now use these funds according to their wallet type.';
    } else {
      title = 'Funds Received';
      headerColor = '#38a169';
      mainMessage = `You have received ₦${amount.toLocaleString()} from ${otherPartyName} into your ${destinationWalletType} wallet.`;
      actionText = marketerLocked 
        ? 'Note: These funds are locked for in-app use only and cannot be withdrawn.'
        : 'You can now use these funds according to your wallet type.';
    }
  }

  const lockWarning = marketerLocked && !isSelfTransfer ? `
    <div style="background:#fff5f5;border-left:4px solid #feb2b2;padding:16px;margin:24px 0;border-radius:4px;">
      <p style="font-size:14px;line-height:1.5;margin:0;color:#c53030;">
        <strong>🔒 Important Note:</strong> Funds transferred to a Marketer wallet are locked for in-app use only and cannot be withdrawn as cash. They can only be used for marketing campaigns within MarketSpase.
      </p>
    </div>
  ` : '';

  const selfLockWarning = isSelfTransfer && isDebit ? `
    <div style="background:#fffaf0;border-left:4px solid #f6ad55;padding:16px;margin:24px 0;border-radius:4px;">
      <p style="font-size:14px;line-height:1.5;margin:0;color:#744210;">
        <strong>💰 Transfer Complete:</strong> Funds moved to your Marketer Wallet are now available for marketing campaigns. These funds cannot be withdrawn as cash and are for in-app use only.
      </p>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} - MarketSpase</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:Arial, sans-serif;color:#2d3748;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
    
    <div style="background:${headerColor};padding:30px 20px;text-align:center;">
      <img src="https://marketspase.com/img/email_logo.jpg" alt="MarketSpase Logo" style="height:60px; border-radius: 50%;">
      <h1 style="color:#fff;font-size:24px;margin:15px 0 0;">${title}</h1>
    </div>
    
    <div style="padding:30px 20px;">
      <p style="font-size:16px;line-height:1.6;margin:0 0 10px;">Hello ${userName},</p>
      
      <p style="font-size:16px;line-height:1.6;margin:0 0 20px;">${mainMessage}</p>

      <div style="background:#f7fafc;padding:20px;border-radius:8px;margin-bottom:24px;">
        <h3 style="font-size:16px;font-weight:600;color:#1a202c;margin:0 0 15px;">Transaction Details:</h3>
        <table style="width:100%;font-size:14px;">
          <tr>
            <td style="padding:5px 0;color:#718096;">Amount:</td>
            <td style="padding:5px 0;font-weight:bold;color:#1a202c;">₦${amount.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#718096;">Reference:</td>
            <td style="padding:5px 0;font-family:monospace;font-size:12px;">${reference}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#718096;">Date:</td>
            <td style="padding:5px 0;">${new Date().toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#718096;">Wallet:</td>
            <td style="padding:5px 0;text-transform:capitalize;">${isDebit ? 'Promoter' : destinationWalletType} Wallet</td>
          </tr>
          ${!isSelfTransfer ? `
          <tr>
            <td style="padding:5px 0;color:#718096;">${isDebit ? 'Recipient:' : 'Sender:'}</td>
            <td style="padding:5px 0;">${otherPartyName}</td>
          </tr>
          ` : ''}
          ${destinationWalletType && !isSelfTransfer && isDebit ? `
          <tr>
            <td style="padding:5px 0;color:#718096;">Recipient Wallet:</td>
            <td style="padding:5px 0;text-transform:capitalize;">${destinationWalletType}</td>
          </tr>
          ` : ''}
          ${note ? `
          <tr>
            <td style="padding:5px 0;color:#718096;">Note:</td>
            <td style="padding:5px 0;font-style:italic;">${note}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding:5px 0;color:#718096;">New Balance:</td>
            <td style="padding:5px 0;font-weight:bold;color:#38a169;">₦${newBalance.toLocaleString()}</td>
          </tr>
        </table>
      </div>

      ${lockWarning}
      ${selfLockWarning}

      <p style="font-size:15px;line-height:1.6;margin:15px 0;">${actionText}</p>

      <div style="text-align:center;margin:30px 0;">
        <a href="https://marketspase.com/dashboard/transactions/transfer" style="display:inline-block;padding:14px 28px;background:#673ab7;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">View Wallet</a>
      </div>

      <div style="background:#ebf8ff;border-left:4px solid #4299e1;padding:16px;margin:24px 0;border-radius:4px;">
        <p style="font-size:14px;line-height:1.5;margin:0;color:#2b6cb0;">
          <strong>💡 Need help?</strong> If you didn't authorize this transaction or have any questions, please contact our support team immediately at <a href="mailto:contact@marketspase.com" style="color:#673ab7;text-decoration:none;">contact@marketspase.com</a>
        </p>
      </div>

      <p style="font-size:15px;margin-top:30px;">
        Best regards,<br>
        <strong>The MarketSpase Team</strong>
      </p>
    </div>

    <div style="background:#1a202c;color:#a0aec0;padding:25px 20px;text-align:center;font-size:13px;">
      <p style="margin:0 0 12px;">© ${year} MarketSpase. All rights reserved.</p>
      <p style="font-style:italic;color:#cbd5e0;">"Connecting marketers and promoters through the power of WhatsApp Status"</p>
      <p style="font-size:12px;margin-top:20px;color:#718096;">
        This is an automated transaction notification. Please do not reply to this email.<br>
        <a href="#" style="color:#a0aec0;text-decoration:none;">Unsubscribe</a> | 
        <a href="#" style="color:#a0aec0;text-decoration:none;">Privacy Policy</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
};