const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatMoney = (amount, currency = 'NGN') => {
  const numeric = Number(amount || 0);
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${currency} ${numeric.toLocaleString('en-NG')}`;
  }
};

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'the stated review date';

  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export const promoterPpcPayoutPolicyTemplate = ({
  promoterName = 'Promoter',
  fixedPayoutPerClick = 0,
  currency = 'NGN',
  reason = '',
  endsAt,
} = {}) => `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f4f7fb;padding:28px 14px;color:#1f2937;">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#111827;color:#ffffff;padding:22px 26px;">
        <h1 style="font-size:22px;line-height:1.3;margin:0;">MarketSpase PPC payout policy update</h1>
        <p style="margin:8px 0 0;color:#d1d5db;font-size:14px;">Important notice about your promoter account</p>
      </div>

      <div style="padding:26px;">
        <p style="font-size:15px;line-height:1.65;margin:0 0 16px;">Hello ${escapeHtml(promoterName)},</p>

        <p style="font-size:15px;line-height:1.65;margin:0 0 16px;">
          We detected promotion activity that violates or appears to violate MarketSpase PPC policy. Because of this, your PPC earning per billable campaign click has been temporarily reduced as a policy punishment.
        </p>

        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px;margin:18px 0;">
          <p style="margin:0 0 8px;font-size:14px;color:#9a3412;"><strong>Your temporary PPC earning rate</strong></p>
          <p style="margin:0;font-size:24px;font-weight:700;color:#7c2d12;">${formatMoney(fixedPayoutPerClick, currency)} per billable click</p>
          <p style="margin:8px 0 0;font-size:13px;color:#9a3412;">This policy is scheduled to end on ${escapeHtml(formatDate(endsAt))}.</p>
        </div>

        <p style="font-size:15px;line-height:1.65;margin:0 0 16px;">
          Reason given by the review team: <strong>${escapeHtml(reason || 'PPC policy enforcement')}</strong>
        </p>

        <p style="font-size:15px;line-height:1.65;margin:0 0 16px;">
          Once the punishment period ends, your PPC payout will automatically return to the normal MarketSpase rate unless further suspicious activity is detected.
        </p>

        <p style="font-size:15px;line-height:1.65;margin:0 0 16px;">
          Please stay away from any attempt to cheat the system, including fake clicks, repeated self-clicks, bot traffic, forced clicks, link farming, or any traffic pattern that does not represent genuine user interest. Continued violations may lead to stronger penalties, including lower earnings, fewer campaigns, account suspension, or permanent removal from promoter opportunities.
        </p>

        <p style="font-size:15px;line-height:1.65;margin:20px 0 0;">Thank you,<br><strong>MarketSpase Trust & Safety</strong></p>
      </div>
    </div>
  </div>
`;
