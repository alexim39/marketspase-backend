// services/email/promotionExpiringTemplate.js
export const promotionExpiringTemplate = (promotionData) => {
  const year = new Date().getFullYear();
  const formattedName = promotionData.promoterName
    ? promotionData.promoterName.charAt(0).toUpperCase() + promotionData.promoterName.slice(1).toLowerCase()
    : '';

  // Calculate expiration time
  const expirationTime = new Date(promotionData.expiresAt);
  const formattedTime = expirationTime.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Promotion Expiring Soon - MarketSpase</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:Arial, sans-serif;color:#2d3748;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
    
    <div style="background:#673ab7;padding:30px 20px;text-align:center;">
      <img src="https://marketspase.com/img/email_logo.jpg" alt="MarketSpase Logo" style="height:60px; border-radius: 50%;">
    </div>
    
    <div style="padding:30px 20px;">
      <h1 style="font-size:24px;font-weight:bold;color:#673ab7;margin:0 0 20px;">⏰ Promotion Expiring Soon!</h1>
      
      <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">Hello ${formattedName},</p>
      
      <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">Your promotion for <strong>"${promotionData.campaignTitle}"</strong> will expire in <strong style="color:#c53030;">4 hours</strong>. Don't miss out on your earnings - upload your proof screenshots now!</p>

      <div style="background:#fffaf0;padding:20px;border-radius:8px;margin-bottom:24px;">
        <h3 style="font-size:16px;font-weight:600;color:#dd6b20;margin:0 0 12px;">📋 Promotion Details</h3>
        <table style="width:100%;font-size:14px;line-height:1.5;">
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Campaign:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">${promotionData.campaignTitle}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Promotion ID:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">${promotionData.promotionId}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Expires At:</strong></td>
            <td style="padding:8px 0;color:#c53030;text-align:right;font-weight:bold;">${formattedTime}</td>
          </tr>
        </table>
      </div>

      <div style="background:#fed7d7;padding:16px;border-radius:8px;margin:24px 0;">
        <p style="font-size:14px;line-height:1.5;margin:0;color:#c53030;">
          <strong>🚨 Important:</strong> If you don't upload your proof within 4 hours, this promotion will be automatically rejected and made available to other promoters.
        </p>
      </div>

      <div style="background:#f7fafc;padding:20px;border-radius:8px;margin-bottom:24px;">
        <h3 style="font-size:16px;font-weight:600;color:#2d3748;margin:0 0 12px;">📸 Proof Requirements</h3>
        <p style="font-size:14px;line-height:1.5;margin:0 0 16px;color:#4a5568;">Upload up to 3 screenshots that clearly show:</p>
        <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.5;color:#4a5568;">
          <li><strong>Promotion ID:</strong> ${promotionData.promotionId} visible in the status</li>
          <li><strong>Status Views:</strong> Must show 40+ views count</li>
          <li><strong>Date & Time:</strong> Current date and time visible</li>
          <li><strong>Clear Visibility:</strong> Content must be readable</li>
        </ul>
      </div>

      <div style="text-align:center;margin:30px 0;">
        <a href="https://marketspase.com/dashboard/promotions/${promotionData.promotionId}/upload-proof" style="display:inline-block;padding:14px 28px;background:#673ab7;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Upload Proof Now</a>
      </div>

      <div style="background:#e6fffa;padding:16px;border-radius:8px;margin:24px 0;">
        <p style="font-size:14px;line-height:1.5;margin:0;color:#234e52;">
          <strong>💡 Tip:</strong> Make sure your screenshots are clear and all required information is visible. Blurry or incomplete proofs may be rejected.
        </p>
      </div>

      <p style="font-size:15px;line-height:1.6;">Need help with proof upload? Contact support at <a href="mailto:support@marketspase.com" style="color:#673ab7;text-decoration:none;">support@marketspase.com</a></p>

      <p style="font-size:15px;margin-top:30px;">Don't miss your earnings!<br><strong>The MarketSpase Team</strong></p>
    </div>

    <div style="background:#1a202c;color:#a0aec0;padding:25px 20px;text-align:center;font-size:13px;">
      <p style="margin:0 0 12px;">© ${year} MarketSpase. All rights reserved.</p>
      <p style="font-style:italic;color:#cbd5e0;">"Where WhatsApp Status Turns into Income"</p>
      <p style="font-size:12px;margin-top:20px;color:#718096;">
        You're receiving this email because you have an active promotion on MarketSpase.<br>
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