import { wrapEmail, brandedButton } from '../../../core/brand-email.js';

export const cartRecoveryTemplate = (name, items, landingUrl) => wrapEmail({
  title: 'Complete Your Purchase',
  preheader: 'You left items in your cart',
  withFooter: true,
  content: `
    <p style="font-size:15px;line-height:1.6;color:#4b5563">Hi ${name},</p>
    <p style="font-size:15px;line-height:1.6;color:#4b5563">We noticed you didn't complete your purchase. Here's what you were looking at:</p>
    ${items.map(i => `<div style="padding:12px;margin-bottom:8px;border:1px solid #eee;border-radius:8px">
      <strong style="font-size:14px;color:#111827">${i.name}</strong>
      <span style="display:block;font-size:13px;color:#6b7280">Qty: ${i.quantity} &middot; ${i.price ? '₦' + i.price.toLocaleString() : ''}</span>
    </div>`).join('')}
    ${landingUrl ? brandedButton('Complete Your Purchase', landingUrl) : ''}
    <p style="font-size:13px;color:#9ca3af;margin:16px 0 0">Items in your cart may sell out soon. Don't miss out!</p>
  `,
});

export const referralRewardTemplate = (name, code, discountPercent, rewardAmount) => wrapEmail({
  title: 'Referral Reward!',
  preheader: `You earned ₦${rewardAmount} from your referral code`,
  withFooter: true,
  content: `
    <p style="font-size:15px;line-height:1.6;color:#4b5563">Hi ${name},</p>
    <p style="font-size:15px;line-height:1.6;color:#4b5563">Someone used your referral code and completed a purchase! Here's your reward:</p>
    <div style="text-align:center;padding:16px;margin:16px 0;background:rgba(103,58,183,0.06);border:1px solid rgba(103,58,183,0.15);border-radius:8px">
      <span style="font-size:13px;color:#673ab7;text-transform:uppercase;letter-spacing:0.05em;font-weight:700">Your code</span>
      <h2 style="margin:4px 0;font-size:28px;color:#673ab7;letter-spacing:0.05em">${code}</h2>
      <span style="font-size:14px;color:#673ab7">Share with friends — they get ${discountPercent}% off, you get ₦${rewardAmount}</span>
    </div>
    <div style="text-align:center">
      <span style="font-size:14px;color:#111827">Your reward:</span>
      <h2 style="margin:4px 0;font-size:32px;color:#673ab7">₦${rewardAmount.toLocaleString()}</h2>
      <span style="font-size:13px;color:#6b7280">Credited to your wallet</span>
    </div>
  `,
});
