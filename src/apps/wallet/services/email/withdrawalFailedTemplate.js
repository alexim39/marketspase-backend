import { wrapEmail, brandedButton } from '../../../../core/brand-email.js';

export const withdrawalFailedTemplate = (userData) => {
  const amount = Number(userData.amount || 0).toLocaleString();

  const content = `
    <p style="font-size:15px;line-height:1.6">Hello ${userData.userName || ''},</p>
    <p>We were unable to process your withdrawal request. Your funds have been refunded to your wallet.</p>
    <div style="background:#f7f5fa;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:4px 0"><strong>Attempted Amount:</strong> ₦${amount}</p>
      ${userData.reason ? `<p style="margin:4px 0"><strong>Reason:</strong> ${userData.reason}</p>` : ''}
    </div>
    <p style="font-size:13px;color:#888">Please verify your bank details and try again. Contact support if the issue persists.</p>
    ${brandedButton('View Wallet', `${process.env.FRONTEND_URL || 'https://marketspase.com'}/dashboard/transactions`)}
  `;

  return wrapEmail({ title: 'Withdrawal Failed', content, withFooter: true });
};
