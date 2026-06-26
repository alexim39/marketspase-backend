export const cartRecoveryTemplate = (name, items, landingUrl) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Inter',Arial,sans-serif;background:#f9fafb;color:#111827">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden">
    <tr><td style="padding:24px 28px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-align:center">
      <h1 style="margin:0;font-size:22px">You left items in your cart</h1>
    </td></tr>
    <tr><td style="padding:24px 28px">
      <p style="margin:0 0 16px;font-size:15px;color:#4b5563">Hi ${name},</p>
      <p style="margin:0 0 16px;font-size:15px;color:#4b5563">We noticed you didn't complete your purchase. Here's what you were looking at:</p>
      ${items.map(i => `<div style="padding:12px;margin-bottom:8px;border:1px solid #e5e7eb;border-radius:8px">
        <strong style="font-size:14px;color:#111827">${i.name}</strong>
        <span style="display:block;font-size:13px;color:#6b7280">Qty: ${i.quantity} &middot; ${i.price ? '₦' + i.price.toLocaleString() : ''}</span>
      </div>`).join('')}
      ${landingUrl ? `<div style="text-align:center;margin:20px 0">
        <a href="${landingUrl}" style="display:inline-block;padding:12px 28px;background:#667eea;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Complete Your Purchase</a>
      </div>` : ''}
      <p style="margin:0;font-size:13px;color:#9ca3af">If you have questions, reply to this email.</p>
    </td></tr>
  </table>
</body>
</html>`;

export const referralRewardTemplate = (name, code, discountPercent, rewardAmount) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Inter',Arial,sans-serif;background:#f9fafb;color:#111827">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden">
    <tr><td style="padding:24px 28px;background:#10b981;color:#fff;text-align:center">
      <h1 style="margin:0;font-size:22px">You earned a reward! 🎉</h1>
    </td></tr>
    <tr><td style="padding:24px 28px">
      <p style="margin:0 0 12px;font-size:15px;color:#4b5563">Hi ${name},</p>
      <p style="margin:0 0 16px;font-size:15px;color:#4b5563">Someone used your referral code and completed a purchase! Here's your reward:</p>
      <div style="text-align:center;padding:16px;margin-bottom:16px;background:#ecfdf5;border:1px solid #10b981;border-radius:8px">
        <span style="font-size:13px;color:#059669;text-transform:uppercase;letter-spacing:0.05em">Your code</span>
        <h2 style="margin:4px 0;font-size:28px;color:#10b981;letter-spacing:0.05em">${code}</h2>
        <span style="font-size:14px;color:#059669">Share with friends — they get ${discountPercent}% off, you get ₦${rewardAmount}</span>
      </div>
      <div style="text-align:center">
        <span style="font-size:14px;color:#111827">Your reward:</span>
        <h2 style="margin:4px 0;font-size:32px;color:#667eea">₦${rewardAmount.toLocaleString()}</h2>
        <span style="font-size:13px;color:#6b7280">Credited to your wallet</span>
      </div>
    </td></tr>
  </table>
</body>
</html>`;
