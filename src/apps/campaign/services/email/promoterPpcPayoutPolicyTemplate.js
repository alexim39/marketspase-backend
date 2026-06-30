import { wrapEmail } from '../../../../core/brand-email.js';

const formatMoney = (amount, currency = 'NGN') => {
  const numeric = Number(amount || 0);
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(numeric);
  } catch { return `${currency} ${numeric.toLocaleString('en-NG')}`; }
};

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'the stated review date';
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

export const promoterPpcPayoutPolicyTemplate = ({
  promoterName = 'Promoter',
  fixedPayoutPerClick = 0,
  currency = 'NGN',
  reason = '',
  endsAt,
} = {}) => {
  const content = `
    <p style="font-size:15px;line-height:1.6">Hello ${promoterName},</p>
    <p>We've temporarily changed your payout to <strong>${formatMoney(fixedPayoutPerClick, currency)} per click</strong> while we review your recent campaign activity.</p>
    ${reason ? `<p style="color:#666;font-size:14px"><strong>Reason:</strong> ${reason}</p>` : ''}
    <p style="font-size:14px">This review will be completed by <strong>${formatDate(endsAt)}</strong>. Your earnings balance and payment timeline remain unchanged during this period.</p>
    <p style="font-size:13px;color:#888">Contact us immediately if you believe this is an error. We'll escalate your case for urgent review.</p>
  `;
  return wrapEmail({ title: 'Payout Policy Update', content, withFooter: true });
};
