import crypto from 'crypto';
import { UserModel} from '../../user/models/user/index.js';
import { sendEmail } from "../../../core/email.service.js";
import { paymentApprovedEmailTemplate } from './email/paymentApprovedTemplate.js';
import { ReferralService } from '../../user/services/referral.service.js';
import mongoose from 'mongoose';
import {
  buildSignedQuote,
  normalizeCurrencyCode,
  roundCurrencyAmount,
  verifySignedQuote,
} from './payment-currency.service.js';
import { applyWalletCredit, ensureWalletCurrencyState } from './wallet-ledger.service.js';

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
      const { reference, metadata, amount: amountInMinorUnits, customer, currency: paystackCurrency } = event.data;
      const chargedAmount = roundCurrencyAmount((amountInMinorUnits || 0) / 100);
      const fundingCurrency = normalizeCurrencyCode(paystackCurrency || metadata?.currency || 'NGN');

      const customFields = Array.isArray(metadata?.custom_fields) ? metadata.custom_fields : [];
      const findCustomField = (varName) => customFields.find(f => f.variable_name === varName)?.value;

      // Extract user info from metadata — try custom_fields first (reliable), then flat metadata keys
      let userId = metadata?.userId || findCustomField('user_id');

      // If userId not in metadata, try to find by reference pattern
      if (!userId) {
        const referenceParts = reference.split('-');
        if (referenceParts.length >= 2 && referenceParts[0] === 'WALLET') {
          userId = referenceParts[1];
        }
      }

      // If still no userId, try by email from custom_fields or customer
      if (!userId) {
        const emailFromMeta = metadata?.userEmail || findCustomField('user_email') || customer?.email;
        if (emailFromMeta) {
          const user = await UserModel.findOne({ email: emailFromMeta }).session(session);
          if (user) userId = user._id;
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

      // Determine funding amount — try custom_fields, then metadata, then fall back to charged amount
      const fundingAmountFromMeta = Number(metadata?.fundingAmount || findCustomField('funding_amount') || 0);
      const effectiveFundingAmount = fundingAmountFromMeta > 0 ? fundingAmountFromMeta : chargedAmount;

      const verifiedQuote = metadata?.quote
        ? await verifySignedQuote(metadata.quote, { purpose: 'wallet_funding' })
        : await buildSignedQuote({
            amount: effectiveFundingAmount,
            fromCurrency: fundingCurrency,
            toCurrency: fundingCurrency,
            purpose: 'wallet_funding',
          });

      const fundingAmount = roundCurrencyAmount(verifiedQuote.targetAmount || effectiveFundingAmount);
      const baseAmount = roundCurrencyAmount(verifiedQuote.baseAmount);
      const baseCurrency = normalizeCurrencyCode(verifiedQuote.baseCurrency || 'NGN');
      
      // Check if first campaign funding
      const isFirstCampaignFunding = !user.qualificationMilestones?.firstCampaignFunded;

      ensureWalletCurrencyState(user.wallets.marketer, baseCurrency);
      applyWalletCredit(user.wallets.marketer, {
        bucket: 'balance',
        amount: fundingAmount,
        currency: fundingCurrency,
        baseAmount,
        baseCurrency,
      });

      user.wallets.marketer.transactions.unshift({
        amount: fundingAmount,
        baseAmount,
        currency: fundingCurrency,
        baseCurrency,
        settlementCurrency: fundingCurrency,
        settlementAmount: chargedAmount,
        exchangeRate: Number(verifiedQuote.exchangeRate || 1),
        type: 'credit',
        category: 'deposit',
        description: `Paystack funding`,
        reference,
        status: 'successful',
        gateway: 'paystack',
        meta: {
          fullWebhookPayload: {
            id: event.data.id,
            domain: event.data.domain,
            channel: event.data.channel,
            ipAddress: event.data.ip_address,
            createdAt: event.data.created_at,
            paidAt: event.data.paid_at,
            currency: paystackCurrency,
          },
          metadata,
          quote: verifiedQuote,
        },
        processedAt: new Date(),
        createdAt: new Date(),
      });
      user.wallets.marketer.transactions = user.wallets.marketer.transactions.slice(0, 500);

      if (isFirstCampaignFunding) {
        user.qualificationMilestones.firstCampaignFunded = true;
      }

      await user.save({ session });
      const updatedUser = user;

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
