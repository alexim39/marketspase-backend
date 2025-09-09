export const userWelcomeEmailTemplate = (user) => {
  const year = new Date().getFullYear();
  const formattedName = user.name
    ? user.name.charAt(0).toUpperCase() + user.name.slice(1).toLowerCase()
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
      <img src="https://marketspase.com/img/logo.JPG" alt="MarketSpase Logo" style="height:36px;">
    </div>
    
    <div style="padding:30px 20px;">
      <h1 style="font-size:24px;font-weight:bold;color:#673ab7;margin:0 0 20px;">Welcome to MarketSpase, ${formattedName}!</h1>
      
      <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">You've just joined the smart way to connect advertisers and promoters through WhatsApp Status. Whether you're looking to promote your content or earn money sharing posts, MarketSpase makes it simple and secure.</p>
      
      <h2 style="font-size:18px;font-weight:600;color:#1a202c;margin:30px 0 16px;">Here's how MarketSpase works:</h2>

      <div style="background:#f7fafc;padding:20px;border-radius:8px;margin-bottom:24px;">
        <h3 style="font-size:16px;font-weight:600;color:#673ab7;margin:0 0 12px;">📢 For Advertisers:</h3>
        <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.5;">
          <li>Upload your posts and set your budget</li>
          <li>Your ads gets a unique tracking ID</li>
          <li>Track reach, views, and campaign performance</li>
          <li>Pay only when promoters deliver results</li>
        </ul>
      </div>

      <div style="background:#f0fff4;padding:20px;border-radius:8px;margin-bottom:24px;">
        <h3 style="font-size:16px;font-weight:600;color:#38a169;margin:0 0 12px;">💰 For Promoters:</h3>
        <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.5;">
          <li>Browse available campaigns and choose what to promote</li>
          <li>Share posts on your WhatsApp Status</li>
          <li>Earn money when your posts get 25+ views within 24 hours</li>
          <li>Build your reputation and access higher-paying campaigns</li>
        </ul>
      </div>

      <h2 style="font-size:18px;font-weight:600;color:#1a202c;margin:30px 0 16px;">Key features you'll love:</h2>

      <ul style="padding-left:0;list-style:none;margin:0 0 30px;">
        <li style="margin-bottom:12px;"><strong>🔒 Secure payments:</strong> Escrow system protects both advertisers and promoters</li>
        <li style="margin-bottom:12px;"><strong>📊 Smart verification:</strong> AI-powered proof system ensures campaign completion</li>
        <li style="margin-bottom:12px;"><strong>⚡ Quick earnings:</strong> Get paid within 24 hours of successful campaigns</li>
        <li style="margin-bottom:12px;"><strong>📱 Mobile-first:</strong> Optimized for seamless mobile experience</li>
        <li style="margin-bottom:12px;"><strong>🎯 Targeted reach:</strong> Connect with the right audience for maximum impact</li>
      </ul>

      <p style="font-size:16px;line-height:1.6;margin-bottom:24px;">Ready to get started? Complete your profile and explore campaigns that match your interests or start promoting your content today!</p>

      <div style="text-align:center;margin:30px 0;">
        <a href="https://marketspase.com/dashboard" style="display:inline-block;padding:14px 28px;background:#c2185b;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Go to Dashboard</a>
      </div>

      <div style="background:#fff5f5;border-left:4px solid #feb2b2;padding:16px;margin:24px 0;border-radius:4px;">
        <p style="font-size:14px;line-height:1.5;margin:0;color:#c53030;"><strong>💡 Pro Tip:</strong> Promoters with higher engagement rates and reliability scores get access to premium campaigns with better payouts!</p>
      </div>

      <p style="font-size:15px;line-height:1.6;">Questions? Check our <a href="https://marketspase.com/faq" style="color:#673ab7;font-weight:600;text-decoration:none;">FAQ</a> or reach out at <a href="mailto:contact@marketspase.com" style="color:#673ab7;text-decoration:none;">contact@marketspase.com</a></p>

      <p style="font-size:15px;margin-top:30px;">Welcome aboard!<br><strong>The MarketSpase Team</strong></p>
    </div>

    <div style="background:#1a202c;color:#a0aec0;padding:25px 20px;text-align:center;font-size:13px;">
      <p style="margin:0 0 12px;">© ${year} MarketSpase. All rights reserved.</p>
      <p style="font-style:italic;color:#cbd5e0;">"Connecting advertisers and promoters through the power of WhatsApp Status"</p>
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