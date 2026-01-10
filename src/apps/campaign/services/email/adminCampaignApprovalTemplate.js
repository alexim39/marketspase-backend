// services/email/adminCampaignApprovalTemplate.js
export const adminCampaignApprovalTemplate = (campaignData) => {
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>New Campaign Pending Approval - MarketSpase</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:Arial, sans-serif;color:#2d3748;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
    
    <div style="background:#673ab7;padding:30px 20px;text-align:center;">
       <img src="https://marketspase.com/img/email_logo.jpg" alt="MarketSpase Logo" style="height:60px; border-radius: 50%;">
    </div>
    
    <div style="padding:30px 20px;">
      <h1 style="font-size:24px;font-weight:bold;color:#673ab7;margin:0 0 20px;">New Campaign Awaiting Approval 🚨</h1>
      
      <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">A new campaign has been submitted and requires your review before it can go live on the platform.</p>

      <div style="background:#fffaf0;padding:20px;border-radius:8px;margin-bottom:24px;">
        <h3 style="font-size:16px;font-weight:600;color:#dd6b20;margin:0 0 12px;">📋 Campaign Summary</h3>
        <table style="width:100%;font-size:14px;line-height:1.5;">
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Campaign Title:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">${campaignData.title}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Campaign ID:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">${campaignData.campaignId}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Marketer:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">${campaignData.marketerName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Budget:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">₦${campaignData.budget.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Category:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">${campaignData.category}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Max Promoters:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">${campaignData.maxPromoters}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Media Type:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;text-transform:capitalize;">${campaignData.mediaType}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4a5568;"><strong>Submitted:</strong></td>
            <td style="padding:8px 0;color:#2d3748;text-align:right;">${new Date().toLocaleString()}</td>
          </tr>
        </table>
      </div>

      ${campaignData.caption ? `
      <div style="background:#f7fafc;padding:16px;border-radius:8px;margin:16px 0;">
        <h4 style="font-size:14px;font-weight:600;color:#2d3748;margin:0 0 8px;">📝 Campaign Caption:</h4>
        <p style="font-size:14px;line-height:1.5;margin:0;color:#4a5568;">${campaignData.caption}</p>
      </div>
      ` : ''}

      ${campaignData.requirements && campaignData.requirements.length > 0 ? `
      <div style="background:#f7fafc;padding:16px;border-radius:8px;margin:16px 0;">
        <h4 style="font-size:14px;font-weight:600;color:#2d3748;margin:0 0 8px;">🎯 Requirements:</h4>
        <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.5;color:#4a5568;">
          ${campaignData.requirements.map(req => `<li>${req}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      ${campaignData.targetLocations && campaignData.targetLocations.length > 0 ? `
      <div style="background:#f7fafc;padding:16px;border-radius:8px;margin:16px 0;">
        <h4 style="font-size:14px;font-weight:600;color:#2d3748;margin:0 0 8px;">📍 Target Locations:</h4>
        <p style="font-size:14px;line-height:1.5;margin:0;color:#4a5568;">${campaignData.targetLocations.join(', ')}</p>
      </div>
      ` : ''}

      <div style="background:#e6fffa;padding:16px;border-radius:8px;margin:24px 0;">
        <p style="font-size:14px;line-height:1.5;margin:0;color:#234e52;">
          <strong>⏰ Action Required:</strong> Please review this campaign within 24 hours to ensure timely activation for promoters.
        </p>
      </div>

      <div style="text-align:center;margin:30px 0;">
        <a href="https://marketspase.com/admin/campaigns/${campaignData.campaignId}/review" style="display:inline-block;padding:14px 28px;background:#673ab7;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Review Campaign Now</a>
      </div>

      <div style="background:#fff5f5;padding:16px;border-radius:8px;margin:24px 0;">
        <h4 style="font-size:14px;font-weight:600;color:#c53030;margin:0 0 8px;">🔍 Review Checklist:</h4>
        <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.5;color:#744210;">
          <li>Verify media content quality and appropriateness</li>
          <li>Check campaign caption and link for compliance</li>
          <li>Confirm budget allocation and payout structure</li>
          <li>Review targeting settings and requirements</li>
          <li>Ensure content follows platform guidelines</li>
        </ul>
      </div>

      <p style="font-size:15px;line-height:1.6;">This is an automated notification. You're receiving this because you're an admin on MarketSpase.</p>

      <p style="font-size:15px;margin-top:30px;">Best regards,<br><strong>MarketSpase Admin System</strong></p>
    </div>

    <div style="background:#1a202c;color:#a0aec0;padding:25px 20px;text-align:center;font-size:13px;">
      <p style="margin:0 0 12px;">© ${year} MarketSpase. All rights reserved.</p>
      <p style="font-style:italic;color:#cbd5e0;">"Where WhatsApp Status Turns into Income"</p>
      <p style="font-size:12px;margin-top:20px;color:#718096;">
        Admin Notification • Do not reply to this email<br>
        <a href="https://marketspase.com/admin/settings" style="color:#a0aec0;text-decoration:none;">Manage Notifications</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
};