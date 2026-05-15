export const userBirthdayEmailTemplate = (user) => {
  const year = new Date().getFullYear();
  const formattedName = user.displayName
    ? user.displayName
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    : 'Valued User';

  const isPromoter = user.role === 'promoter';
  const isMarketer = user.role === 'marketer';
  const userRole = isPromoter ? 'Promoter' : (isMarketer ? 'Marketer' : 'User');

  const walletBalance = isPromoter
    ? user.wallets?.promoter?.balance || 0
    : user.wallets?.marketer?.balance || 0;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Happy Birthday from MarketSpase!</title>
</head>
<body style="margin:0;padding:0;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);font-family:Arial, sans-serif;color:#2d3748;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eee;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
    <div style="background:linear-gradient(135deg, #f093fb 0%, #f5576c 100%);padding:40px 20px;text-align:center;position:relative;">
      <div style="position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.2);padding:8px 16px;border-radius:20px;font-size:12px;color:white;font-weight:bold;">
        ${userRole}
      </div>

      <img src="https://marketspase.com/img/email_logo.jpg" alt="MarketSpase Logo" style="height:80px;border-radius:50%;margin-bottom:20px;border:4px solid rgba(255,255,255,0.3);">

      <div style="margin-top:20px;">
        <h1 style="font-size:42px;font-weight:800;color:white;margin:0;text-shadow:2px 2px 4px rgba(0,0,0,0.2);">Happy Birthday!</h1>
        <p style="font-size:20px;color:rgba(255,255,255,0.9);margin:10px 0 0;">${formattedName}</p>
      </div>
    </div>

    <div style="padding:40px 30px;">
      <div style="text-align:center;margin-bottom:40px;">
        <p style="font-size:24px;font-weight:600;color:#4a5568;margin-bottom:20px;">We're so glad you're part of the MarketSpase family!</p>
        <p style="font-size:18px;line-height:1.6;color:#718096;margin-bottom:30px;">
          On your special day, we want to thank you for being an amazing ${user.role === 'promoter' ? 'promoter' : 'marketer'}
          and helping us build a community where marketers, promoters, and storefront brands thrive together.
        </p>
      </div>

      <div style="background:#f8f9fa;border-radius:12px;padding:30px;margin-bottom:40px;">
        <h2 style="font-size:20px;font-weight:700;color:#2d3748;margin:0 0 25px;text-align:center;">Your MarketSpase Journey</h2>

        <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;">
          ${isPromoter ? `
          <div style="flex:1;min-width:200px;background:white;padding:20px;border-radius:10px;text-align:center;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
            <div style="font-size:32px;font-weight:800;color:#48bb78;margin-bottom:10px;">N${walletBalance.toLocaleString()}</div>
            <div style="font-size:14px;color:#718096;">Available Balance</div>
          </div>

          <div style="flex:1;min-width:200px;background:white;padding:20px;border-radius:10px;text-align:center;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
            <div style="font-size:32px;font-weight:800;color:#4299e1;margin-bottom:10px;">${user.rating || 0}</div>
            <div style="font-size:14px;color:#718096;">Rating</div>
          </div>
          ` : ''}

          ${isMarketer ? `
          <div style="flex:1;min-width:200px;background:white;padding:20px;border-radius:10px;text-align:center;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
            <div style="font-size:32px;font-weight:800;color:#ed8936;margin-bottom:10px;">${user.testimonials?.length || 0}</div>
            <div style="font-size:14px;color:#718096;">Testimonials</div>
          </div>

          <div style="flex:1;min-width:200px;background:white;padding:20px;border-radius:10px;text-align:center;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
            <div style="font-size:32px;font-weight:800;color:#9f7aea;margin-bottom:10px;">${user.referralInfo?.totalReferrals || 0}</div>
            <div style="font-size:14px;color:#718096;">Referrals</div>
          </div>
          ` : ''}
        </div>
      </div>

      <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);border-radius:12px;padding:30px;margin-bottom:40px;color:white;">
        <h2 style="font-size:22px;font-weight:700;margin:0 0 20px;">A Special Gift For You</h2>
        <p style="font-size:16px;line-height:1.6;margin-bottom:20px;opacity:0.95;">
          As our birthday gift to you, we've added <strong style="font-size:18px;">N50 bonus</strong> to your account!
          Use it to ${isPromoter ? 'take on more promotions and grow your click earnings' : 'fund your next click campaign or storefront push'} and make this birthday extra special.
        </p>
        <p style="font-size:14px;font-style:italic;margin:0;opacity:0.8;">
          *Bonus will be credited to your ${user.role} wallet within 24 hours
        </p>
      </div>

      <div style="text-align:center;margin:40px 0;">
        ${isPromoter ? `
        <a href="https://marketspase.com/dashboard/campaigns" style="display:inline-block;padding:18px 40px;background:linear-gradient(135deg, #f093fb 0%, #f5576c 100%);color:#fff;text-decoration:none;border-radius:50px;font-weight:bold;font-size:18px;margin:10px;box-shadow:0 8px 20px rgba(245,87,108,0.3);">
          Claim Birthday Opportunities
        </a>
        ` : ''}

        ${isMarketer ? `
        <a href="https://marketspase.com/dashboard/campaigns/create" style="display:inline-block;padding:18px 40px;background:linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);color:#fff;text-decoration:none;border-radius:50px;font-weight:bold;font-size:18px;margin:10px;box-shadow:0 8px 20px rgba(79,172,254,0.3);">
          Launch Birthday Promotion
        </a>
        ` : ''}

        <a href="https://marketspase.com/dashboard" style="display:inline-block;padding:18px 40px;background:#2d3748;color:#fff;text-decoration:none;border-radius:50px;font-weight:bold;font-size:18px;margin:10px;">
          Visit Your Dashboard
        </a>
      </div>

      <div style="border-top:2px solid #e2e8f0;padding-top:40px;margin-top:40px;">
        <h3 style="font-size:18px;font-weight:600;color:#2d3748;margin-bottom:20px;text-align:center;">Make Your Birthday Even Better</h3>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(250px, 1fr));gap:20px;">
          ${isPromoter ? `
          <div style="background:#f0fff4;padding:20px;border-radius:10px;">
            <div style="font-size:24px;margin-bottom:10px;">Growth</div>
            <h4 style="font-size:16px;font-weight:600;color:#38a169;margin:0 0 10px;">Grow Your Click Earnings</h4>
            <p style="font-size:14px;color:#718096;margin:0;line-height:1.5;">Promote your strongest campaigns today and turn your birthday bonus into more verified clicks.</p>
          </div>

          <div style="background:#fff5f5;padding:20px;border-radius:10px;">
            <div style="font-size:24px;margin-bottom:10px;">Focus</div>
            <h4 style="font-size:16px;font-weight:600;color:#c53030;margin:0 0 10px;">Premium Opportunities</h4>
            <p style="font-size:14px;color:#718096;margin:0;line-height:1.5;">Use the day to focus on premium campaigns with stronger payout potential and better audience fit.</p>
          </div>
          ` : ''}

          ${isMarketer ? `
          <div style="background:#ebf8ff;padding:20px;border-radius:10px;">
            <div style="font-size:24px;margin-bottom:10px;">Scale</div>
            <h4 style="font-size:16px;font-weight:600;color:#3182ce;margin:0 0 10px;">Boost Your Reach</h4>
            <p style="font-size:14px;color:#718096;margin:0;line-height:1.5;">Launch a fresh campaign today and use your bonus to bring in more verified traffic.</p>
          </div>

          <div style="background:#faf5ff;padding:20px;border-radius:10px;">
            <div style="font-size:24px;margin-bottom:10px;">Network</div>
            <h4 style="font-size:16px;font-weight:600;color:#805ad5;margin:0 0 10px;">Referral Momentum</h4>
            <p style="font-size:14px;color:#718096;margin:0;line-height:1.5;">Invite friends today and grow your network as they activate campaigns or storefront promotions.</p>
          </div>
          ` : ''}
        </div>
      </div>

      <div style="text-align:center;margin-top:50px;">
        <p style="font-size:16px;color:#4a5568;margin-bottom:10px;">
          Wishing you a day filled with joy, success, and meaningful growth across every campaign you touch!
        </p>
        <p style="font-size:14px;color:#718096;margin-top:30px;">
          Celebrate your special day with MarketSpase - where every quality click and conversion counts.
        </p>
      </div>
    </div>

    <div style="background:#1a202c;color:#a0aec0;padding:30px 20px;text-align:center;">
      <div style="margin-bottom:20px;">
        <p style="font-size:14px;margin:0 0 15px;">Share the celebration with friends!</p>
        <div style="display:flex;justify-content:center;gap:15px;align-items:center;">
          <a href="#" style="color:#a0aec0;text-decoration:none;font-size:12px;">Invite Friends</a> | &nbsp;
          <a href="#" style="color:#a0aec0;text-decoration:none;font-size:12px;">Share on X</a> | &nbsp;
          <a href="https://whatsapp.com/channel/0029Vb77xA51NCrKysUMO11D" target="_blank" style="color:#a0aec0;text-decoration:none;font-size:12px;">WhatsApp Channel</a>
        </div>
      </div>

      <p style="margin:0 0 12px;font-size:13px;">&copy; ${year} MarketSpase. All rights reserved.</p>
      <p style="font-style:italic;color:#cbd5e0;margin-bottom:20px;font-size:12px;">
        "Making birthdays more rewarding, one milestone at a time"
      </p>
      <p style="font-size:11px;margin-top:20px;color:#718096;">
        You're receiving this email because today is your birthday in our records.<br>
        <a href="#" style="color:#a0aec0;text-decoration:none;">Update Birthday</a> |
        <a href="#" style="color:#a0aec0;text-decoration:none;">Email Preferences</a> |
        <a href="#" style="color:#a0aec0;text-decoration:none;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
};
