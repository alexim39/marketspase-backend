export const campaignLeadTemplate = (data) => {
  const name = data.marketerName || 'there';
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>New Campaign Lead — MarketSpase</title></head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:Arial,sans-serif;color:#2d3748;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
    <div style="background:#673ab7;padding:30px 20px;text-align:center;">
      <img src="https://marketspase.com/img/email_logo.jpg" alt="MarketSpase" style="height:60px;border-radius:50%;">
    </div>
    <div style="padding:30px 20px;">
      <h1 style="font-size:22px;font-weight:bold;color:#673ab7;margin:0 0 16px;">New Campaign Lead Received 🎉</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">Hi ${name},</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">A new lead has been captured from your campaign <strong>${data.campaignTitle}</strong>. The contact has been added to your Contact Manager.</p>
      <div style="background:#f5f0ff;padding:20px;border-radius:8px;margin-bottom:24px;">
        <h3 style="font-size:16px;font-weight:600;color:#673ab7;margin:0 0 12px;">Lead Details</h3>
        <table style="width:100%;font-size:14px;line-height:1.5;">
          <tr><td style="padding:8px 0;color:#4a5568;"><strong>Phone:</strong></td><td style="padding:8px 0;color:#2d3748;text-align:right;">${data.phone}</td></tr>
          ${data.email ? `<tr><td style="padding:8px 0;color:#4a5568;"><strong>Email:</strong></td><td style="padding:8px 0;color:#2d3748;text-align:right;">${data.email}</td></tr>` : ''}
          <tr><td style="padding:8px 0;color:#4a5568;"><strong>Campaign:</strong></td><td style="padding:8px 0;color:#2d3748;text-align:right;">${data.campaignTitle}</td></tr>
          <tr><td style="padding:8px 0;color:#4a5568;"><strong>Promoter:</strong></td><td style="padding:8px 0;color:#2d3748;text-align:right;">${data.promoterName || 'N/A'}</td></tr>
          <tr><td style="padding:8px 0;color:#4a5568;"><strong>Date:</strong></td><td style="padding:8px 0;color:#2d3748;text-align:right;">${new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
        </table>
      </div>
      <a href="https://marketspase.com/dashboard/stores/contacts" style="display:inline-block;background:#673ab7;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">View in Contact Manager →</a>
      <p style="font-size:13px;color:#9ca3af;margin:24px 0 0;">MarketSpase — Campaign Lead Notification</p>
    </div>
  </div>
</body>
</html>`;
};
