import { wrapEmail, brandedButton } from '../../../../core/brand-email.js';

export const transferNotificationEmailTemplate = (data) => {
  const { userName, transferType, amount, reference, otherPartyName, destinationWalletType, newBalance, note } = data;
  const formattedAmount = Number(amount || 0).toLocaleString();
  const formattedBalance = Number(newBalance || 0).toLocaleString();
  const isSelf = transferType === 'self';

  const title = isSelf ? 'Wallet Transfer' : 'Wallet Transfer Received';
  const description = isSelf
    ? `You transferred ₦${formattedAmount} from your ${destinationWalletType || ''} wallet to your other wallet.`
    : `You received a transfer of ₦${formattedAmount} from ${otherPartyName || 'another user'}.`;

  const content = `
    <p style="font-size:15px;line-height:1.6">Hello ${userName || ''},</p>
    <p>${description}</p>
    <div style="background:#f7f5fa;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:4px 0"><strong>Amount:</strong> ₦${formattedAmount}</p>
      ${reference ? `<p style="margin:4px 0"><strong>Reference:</strong> ${reference}</p>` : ''}
      ${note ? `<p style="margin:4px 0"><strong>Note:</strong> ${note}</p>` : ''}
      <p style="margin:4px 0"><strong>New Balance:</strong> ₦${formattedBalance}</p>
    </div>
    ${brandedButton('View Wallet', `${process.env.FRONTEND_URL || 'https://marketspase.com'}/dashboard/transactions`)}
  `;

  return wrapEmail({ title, content, withFooter: true });
};
