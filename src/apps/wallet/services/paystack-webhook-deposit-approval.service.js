import crypto from 'crypto';
import { UserModel} from '../../user/models/user.model.js';
import { sendEmail } from "../../../core/email.service.js";
import { paymentApprovedEmailTemplate } from './email/paymentApprovedTemplate.js';
import { ReferralService } from '../../user/services/referral.service.js';
import mongoose from 'mongoose';

const referralService = new ReferralService();

export default async function handler(req, res) {
  // Verify webhook signature
  const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    console.error('Invalid webhook signature');
    return res.status(401).send('Unauthorized');
  }

  const event = req.body;

  // Log webhook for debugging
  console.log('Webhook received:', event.event, event.data.reference);

  // Only process successful charge events
  if (event.event === 'charge.success') {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { reference, metadata, amount: amountInKobo, customer } = event.data;
      const amountInNaira = amountInKobo / 100;

      // Extract user info from metadata
      let userId = metadata?.userId;
      
      // If userId not in metadata, try to find by email or reference
      if (!userId) {
        // Try to find by reference pattern
        const referenceParts = reference.split('-');
        if (referenceParts.length >= 2 && referenceParts[0] === 'WALLET') {
          userId = referenceParts[1];
        }
      }

      // If still no userId, find by email
      if (!userId && customer?.email) {
        const user = await UserModel.findOne({ email: customer.email }).session(session);
        if (user) {
          userId = user._id;
        }
      }

      if (!userId) {
        throw new Error('Could not identify user from webhook payload');
      }

      // Check for duplicate processing (idempotency)
      const existingTransaction = await UserModel.findOne({
        $or: [
          { 'wallets.marketer.transactions.reference': reference },
          { 'wallets.promoter.transactions.reference': reference }
        ]
      }).session(session);

      if (existingTransaction) {
        console.log(`Transaction ${reference} already processed`);
        await session.commitTransaction();
        session.endSession();
        return res.status(200).send('OK');
      }

      // Find user
      const user = await UserModel.findById(userId).session(session);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Determine funding amount from metadata or use full amount
      const fundingAmount = metadata?.fundingAmount || amountInNaira;
      
      // Check if first campaign funding
      const isFirstCampaignFunding = !user.qualificationMilestones?.firstCampaignFunded;

      // Update wallet
      const updatedUser = await UserModel.findByIdAndUpdate(
        userId,
        {
          $inc: { 
            'wallets.marketer.balance': fundingAmount 
          },
          $push: {
            'wallets.marketer.transactions': {
              amount: fundingAmount,
              type: 'credit',
              category: 'deposit',
              description: `Paystack funding`,
              reference: reference,
              status: 'successful',
              gateway: 'paystack',
              meta: {
                fullWebhookPayload: {
                  id: event.data.id,
                  domain: event.data.domain,
                  channel: event.data.channel,
                  ipAddress: event.data.ip_address,
                  createdAt: event.data.created_at,
                  paidAt: event.data.paid_at
                },
                metadata: metadata
              },
              processedAt: new Date(),
              createdAt: new Date()
            }
          },
          ...(isFirstCampaignFunding && {
            $set: {
              'qualificationMilestones.firstCampaignFunded': true
            }
          })
        },
        { 
          session, 
          new: true,
          runValidators: true
        }
      );

      if (!updatedUser) {
        throw new Error('Failed to update user wallet');
      }

      await session.commitTransaction();
      session.endSession();

      console.log(`Payment recorded successfully for user ${userId}, reference: ${reference}`);

      // Handle referral (background)
      if (isFirstCampaignFunding && fundingAmount >= 2000) {
        referralService.checkMarketerFirstCampaign(userId).catch(err => {
          console.error('Referral processing error:', err);
        });
      }

      // Send email (background)
      sendEmail(
        updatedUser.email,
        'Payment Approved - Wallet Funded',
        paymentApprovedEmailTemplate({
          userName: updatedUser.displayName,
          amount: fundingAmount,
          transactionReference: reference,
          newBalance: updatedUser.wallets.marketer.balance,
        })
      ).catch(err => console.error('Email sending error:', err));

      // Respond to Paystack
      res.status(200).send('OK');

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      
      console.error('Webhook processing error:', error);
      
      // Still return 200 to prevent Paystack from retrying endlessly
      // but log the error for manual review
      res.status(200).send('Webhook received but processing failed - will be reviewed');
    }
  } else {
    // Acknowledge other events
    res.status(200).send('OK');
  }
};