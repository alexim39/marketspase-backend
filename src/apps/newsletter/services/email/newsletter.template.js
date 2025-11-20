export const newsletterEmailTemplate = (newsletter, user, trackingPixelUrl = null, unsubscribeUrl = null) => {
  const year = new Date().getFullYear();
  const formattedName = user.displayName
    ? user.displayName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    : 'there';

  // Convert content to HTML if it's markdown-like format
  const formatContent = (content) => {
    if (!content) return '';
    
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color:#673ab7;text-decoration:none;font-weight:600;">$1</a>');
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${newsletter.subject}</title>
  <style>
    @media only screen and (max-width: 600px) {
      .container {
        width: 100% !important;
        padding: 10px !important;
      }
      .content {
        padding: 20px !important;
      }
      .button {
        display: block !important;
        width: 100% !important;
        text-align: center !important;
      }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:Arial, sans-serif;color:#2d3748;">
  ${trackingPixelUrl ? `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="">` : ''}
  
  <div class="container" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg, #673ab7 0%, #8561c5 100%);padding:25px 20px;text-align:center;">
      <img src="https://marketspase.com/img/email_logo.jpg" alt="MarketSpase Logo" style="height:50px; border-radius: 50%;margin-bottom:15px;">
      <h1 style="color:white;font-size:20px;font-weight:bold;margin:0;letter-spacing:0.5px;">MarketSpase Newsletter</h1>
    </div>
    
    <!-- Preview Text (Hidden but shown in email clients) -->
    <div style="display:none;font-size:0;line-height:0;max-height:0;max-width:0;opacity:0;overflow:hidden;">
      ${newsletter.previewText || 'Latest updates from MarketSpase'}
    </div>
    
    <!-- Main Content -->
    <div class="content" style="padding:30px 25px;">
      
      <!-- Greeting -->
      <div style="margin-bottom:25px;">
        <!-- <p style="font-size:16px;color:#718096;margin:0 0 8px;">Hello ${formattedName},</p> -->
        <h2 style="font-size:24px;font-weight:bold;color:#1a202c;margin:0;line-height:1.3;">${newsletter.subject}</h2>
        ${newsletter.previewText ? `<p style="font-size:16px;color:#718096;margin:10px 0 0;font-style:italic;">${newsletter.previewText}</p>` : ''}
      </div>
      
      <!-- Newsletter Content -->
      <div style="font-size:16px;line-height:1.6;color:#2d3748;">
        ${formatContent(newsletter.content)}
      </div>
      
      <!-- Call to Action Section -->
      <div style="background:#f7fafc;padding:20px;border-radius:8px;margin:30px 0;text-align:center;">
        <h3 style="font-size:18px;font-weight:600;color:#1a202c;margin:0 0 12px;">Ready to take action?</h3>
        <p style="font-size:15px;color:#718096;margin:0 0 20px;">Visit your dashboard to explore new campaigns or check your earnings.</p>
        <a href="https://marketspase.com/dashboard" class="button" style="display:inline-block;padding:12px 24px;background:#673ab7;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;">
          Go to Dashboard
        </a>
      </div>
      
      <!-- Additional Resources -->
      <div style="border-top:1px solid #e2e8f0;padding-top:25px;margin-top:25px;">
        <h4 style="font-size:16px;font-weight:600;color:#1a202c;margin:0 0 15px;">Quick Links</h4>
        <div style="display:flex;flex-wrap:wrap;gap:15px;">
          <a href="https://marketspase.com/campaigns" style="flex:1;min-width:120px;background:#f8f9fa;padding:12px;border-radius:6px;text-decoration:none;color:#673ab7;font-size:14px;text-align:center;font-weight:600;">
            📢 Browse Campaigns
          </a>
          <a href="https://marketspase.com/promotions" style="flex:1;min-width:120px;background:#f8f9fa;padding:12px;border-radius:6px;text-decoration:none;color:#673ab7;font-size:14px;text-align:center;font-weight:600;">
            💰 View Earnings
          </a>
          <a href="https://marketspase.com/resources" style="flex:1;min-width:120px;background:#f8f9fa;padding:12px;border-radius:6px;text-decoration:none;color:#673ab7;font-size:14px;text-align:center;font-weight:600;">
            📚 Resources
          </a>
        </div>
      </div>
      
      <!-- Tip Section -->
      <div style="background:#fff5f5;border-left:4px solid #feb2b2;padding:16px;margin:25px 0;border-radius:4px;">
        <p style="font-size:14px;line-height:1.5;margin:0;color:#c53030;">
          <strong>💡 Pro Tip:</strong> ${user.role === 'promoter' 
            ? 'Complete your profile to get matched with better-paying campaigns!' 
            : user.role === 'marketer'
            ? 'Set clear campaign goals and target audience for better promoter engagement!'
            : 'Stay active on the platform to maximize your opportunities!'}
        </p>
      </div>

    </div>
    
    <!-- Footer -->
    <div style="background:#1a202c;color:#a0aec0;padding:25px 20px;text-align:center;font-size:13px;">
      
      <!-- Social Links -->
      <div style="margin-bottom:20px;">
        <a href="#" style="display:inline-block;margin:0 8px;color:#a0aec0;text-decoration:none;">
          <img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" alt="Facebook" width="24" height="24" style="border-radius:50%;">
        </a>
        <a href="#" style="display:inline-block;margin:0 8px;color:#a0aec0;text-decoration:none;">
          <img src="https://cdn-icons-png.flaticon.com/512/124/124021.png" alt="Twitter" width="24" height="24" style="border-radius:50%;">
        </a>
        <a href="#" style="display:inline-block;margin:0 8px;color:#a0aec0;text-decoration:none;">
          <img src="https://cdn-icons-png.flaticon.com/512/124/124027.png" alt="LinkedIn" width="24" height="24" style="border-radius:50%;">
        </a>
      </div>
      
      <p style="margin:0 0 12px;line-height:1.4;">
        MarketSpase - Connecting marketers and promoters through WhatsApp Status<br>
        Lagos, Nigeria
      </p>
      
      <p style="margin:0 0 20px;font-size:12px;color:#718096;">
        © ${year} MarketSpase. All rights reserved.
      </p>
      
      <!-- Legal Links -->
      <div style="border-top:1px solid #2d3748;padding-top:20px;">
        <p style="margin:0 0 15px;font-size:12px;color:#718096;">
          You're receiving this email because you're a registered MarketSpase user.
        </p>
        <p style="margin:0;font-size:12px;">
          ${unsubscribeUrl 
            ? `<a href="${unsubscribeUrl}" style="color:#a0aec0;text-decoration:none;margin:0 10px;">Unsubscribe</a> | `
            : ''}
          <a href="https://marketspase.com/preferences" style="color:#a0aec0;text-decoration:none;margin:0 10px;">Manage Preferences</a> |
          <a href="https://marketspase.com/privacy" style="color:#a0aec0;text-decoration:none;margin:0 10px;">Privacy Policy</a> |
          <a href="https://marketspase.com/contact" style="color:#a0aec0;text-decoration:none;margin:0 10px;">Contact Us</a>
        </p>
      </div>
    </div>
    
  </div>
</body>
</html>
`;
};

// Plain text version for email clients that don't support HTML
export const newsletterPlainTextTemplate = (newsletter, user) => {
  const formattedName = user.displayName
    ? user.displayName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    : 'there';

  // Strip HTML tags and format for plain text
  const formatPlainText = (content) => {
    if (!content) return '';
    
    return content
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1 ($2)')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '');
  };

  return `
MARKETSPASE NEWSLETTER
======================

Hello ${formattedName},

${newsletter.subject}

${newsletter.previewText ? newsletter.previewText + '\n' : ''}

${formatPlainText(newsletter.content)}

Quick Links:
- Browse Campaigns: https://marketspase.com/campaigns
- View Earnings: https://marketspase.com/promotions  
- Resources: https://marketspase.com/resources
- Dashboard: https://marketspase.com/dashboard

Pro Tip: ${user.role === 'promoter' 
  ? 'Complete your profile to get matched with better-paying campaigns!' 
  : user.role === 'marketer'
  ? 'Set clear campaign goals and target audience for better promoter engagement!'
  : 'Stay active on the platform to maximize your opportunities!'}

---
MarketSpase - Connecting marketers and promoters through WhatsApp Status
Lagos, Nigeria

You're receiving this email because you're a registered MarketSpase user.
Unsubscribe: https://marketspase.com/unsubscribe
Manage Preferences: https://marketspase.com/preferences
Privacy Policy: https://marketspase.com/privacy

© ${new Date().getFullYear()} MarketSpase. All rights reserved.
`.trim();
};