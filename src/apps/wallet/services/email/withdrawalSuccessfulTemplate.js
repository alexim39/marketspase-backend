import { wrapEmail, brandedButton } from '../../../../core/brand-email.js';

export const withdrawalSuccessfulTemplate = (userData) => {
  const amount = Number(userData.amount || 0).toLocaleString();
  const fee = Number(userData.fee || 0).toLocaleString();
  const net = Number(userData.net || userData.amount - (userData.fee || 0) || 0).toLocaleString();

  const content = `
    <p style="font-size:15px;line-height:1.6">Hello ${userData.userName || ''},</p>
    <p>Your withdrawal request has been processed successfully. The funds should reflect in your bank account shortly.</p>
    <div style="background:#f7f5fa;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:4px 0"><strong>Amount:</strong> ₦${amount}</p>
      <p style="margin:4px 0"><strong>Fee:</strong> ₦${fee}</p>
      <p style="margin:4px 0"><strong>Net Amount:</strong> ₦${net}</p>
      ${userData.reference ? `<p style="margin:4px 0"><strong>Reference:</strong> ${userData.reference}</p>` : ''}
    </div>
    ${brandedButton('View Wallet', `${process.env.FRONTEND_URL || 'https://marketspase.com'}/dashboard/transactions`)}
  `;

  return wrapEmail({ title: 'Withdrawal Successful', content, withFooter: true });
};
