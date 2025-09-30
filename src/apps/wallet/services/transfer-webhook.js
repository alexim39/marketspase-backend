import { UserModel } from '../../user/models/user.model.js';
import { sendEmail } from "../../../services/emailService.js";
import { withdrawalSuccessfulTemplate } from './email/withdrawalSuccessfulTemplate.js';
import { withdrawalFailedTemplate } from './email/withdrawalFailedTemplate.js';

export const handleTransferWebhook = async (event) => {
  try {
    const { data: transferData, event: eventType } = event;

    console.log(`Processing webhook: ${eventType} for reference: ${transferData.reference}`);

    // Find user with this transaction reference
    const users = await UserModel.find({
      'wallets.promoter.transactions.reference': transferData.reference
    });

    if (users.length === 0) {
      console.log(`No user found for transaction reference: ${transferData.reference}`);
      return;
    }

    const user = users[0];
    const transactionIndex = user.wallets.promoter.transactions.findIndex(
      txn => txn.reference === transferData.reference
    );

    if (transactionIndex === -1) {
      console.log(`Transaction not found for reference: ${transferData.reference}`);
      return;
    }

    const transaction = user.wallets.promoter.transactions[transactionIndex];

    switch (eventType) {
      case 'transfer.success':
        transaction.status = 'successful';
        transaction.processedAt = new Date();
        transaction.transferCode = transferData.transfer_code;
        
        console.log(`Transfer successful for user: ${user._id}, amount: ${transferData.amount / 100}`);
        
        // Send success email
        try {
          const emailContent = withdrawalSuccessfulTemplate({
            userName: user.displayName,
            amount: transaction.amount,
            accountNumber: transaction.description?.match(/ending in (\d+)/)?.[1] || '****',
            bankName: transaction.description?.match(/to (.+?) account/)?.[1] || 'your bank',
            fee: transaction.fee,
            newBalance: user.wallets.promoter.balance
          });
          
          await sendEmail({
            to: user.email,
            subject: 'Withdrawal Successful - MarketSpase',
            html: emailContent
          });
        } catch (emailError) {
          console.error('Failed to send success email notification:', emailError);
        }
        break;

      case 'transfer.failed':
        transaction.status = 'failed';
        transaction.failureReason = transferData.reason || transferData.message || 'Transfer failed';
        transaction.processedAt = new Date();
        
        // Refund the amount to user's wallet
        const refundAmount = transaction.amount + transaction.fee;
        user.wallets.promoter.balance += refundAmount;
        
        console.log(`Transfer failed for user: ${user._id}, refunded: ${refundAmount}`);
        
        // Send failure email
        try {
          const emailContent = withdrawalFailedTemplate({
            userName: user.displayName,
            amount: transaction.amount,
            accountNumber: transaction.description?.match(/ending in (\d+)/)?.[1] || '****',
            bankName: transaction.description?.match(/to (.+?) account/)?.[1] || 'your bank',
            reason: transaction.failureReason,
            refundedAmount: refundAmount,
            newBalance: user.wallets.promoter.balance
          });
          
          await sendEmail({
            to: user.email,
            subject: 'Withdrawal Failed - MarketSpase',
            html: emailContent
          });
        } catch (emailError) {
          console.error('Failed to send failure email notification:', emailError);
        }
        break;

      case 'transfer.reversed':
        transaction.status = 'reversed';
        transaction.processedAt = new Date();
        
        // Refund the amount
        const reversedAmount = transaction.amount + transaction.fee;
        user.wallets.promoter.balance += reversedAmount;
        
        console.log(`Transfer reversed for user: ${user._id}, refunded: ${reversedAmount}`);
        break;

      case 'transfer.pending':
        transaction.status = 'processing';
        console.log(`Transfer pending for user: ${user._id}`);
        break;

      default:
        console.log(`Unhandled webhook event: ${eventType}`);
        return;
    }

    await user.save();
    console.log(`Webhook processed successfully for user: ${user._id}`);

  } catch (error) {
    console.error('Webhook processing error:', error);
    throw error;
  }
};