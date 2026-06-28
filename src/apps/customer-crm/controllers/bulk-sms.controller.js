import { SmsHistoryModel } from '../models/sms-history.model.js';
import { CustomerModel } from '../models/customer.model.js';
import { sendBulkSms as sendViaProvider } from '../services/sms.service.js';
import { UserModel } from '../../user/models/user/index.js';
import { applyWalletDebit, ensureWalletCurrencyState } from '../../wallet/services/wallet-ledger.service.js';
import { roundCurrencyAmount } from '../../wallet/services/payment-currency.service.js';

const SMS_COST_PER_RECIPIENT = 10;
const SMS_CHARS_PER_PAGE = 160;
const SMS_CURRENCY = 'NGN';

function countPages(message) { return Math.ceil(message.length / SMS_CHARS_PER_PAGE); }

const chargeMarketerForSms = async (marketerId, recipientCount) => {
  const totalCost = roundCurrencyAmount(SMS_COST_PER_RECIPIENT * recipientCount);
  const user = await UserModel.findById(marketerId);
  if (!user) throw Object.assign(new Error('Marketer account not found.'), { status: 404 });
  if (!user.wallets?.marketer) throw Object.assign(new Error('Marketer wallet not configured.'), { status: 400 });

  ensureWalletCurrencyState(user.wallets.marketer, SMS_CURRENCY);
  const balance = user.wallets.marketer.balance || 0;

  if (balance < totalCost) return null;

  applyWalletDebit(user.wallets.marketer, {
    bucket: 'balance',
    amount: totalCost,
    currency: SMS_CURRENCY,
  });

  user.wallets.marketer.transactions.unshift({
    amount: totalCost, currency: SMS_CURRENCY, baseAmount: totalCost, baseCurrency: SMS_CURRENCY,
    settlementCurrency: SMS_CURRENCY, settlementAmount: totalCost, exchangeRate: 1,
    type: 'debit', category: 'sms',
    description: `SMS charge: ${recipientCount} recipient(s) × ₦${SMS_COST_PER_RECIPIENT}`,
    status: 'successful',
    reference: `SMS_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    gateway: 'system',
    createdAt: new Date(),
  });

  user.wallets.marketer.transactions = user.wallets.marketer.transactions.slice(0, 500);
  await user.save();
  return { user, totalCost, newBalance: user.wallets.marketer.balance };
};

export const sendBulkSms = async (req, res) => {
  try {
    const { contactIds, message } = req.body;
    if (!contactIds?.length || !message?.trim()) {
      return res.status(400).json({ success: false, message: 'Select contacts and enter a message' });
    }

    const contacts = await CustomerModel.find({
      _id: { $in: contactIds },
      marketer: req.userId,
      phone: { $exists: true, $ne: null, $ne: '' },
    }).select('phone displayName email').lean();

    if (!contacts.length) return res.status(404).json({ success: false, message: 'No valid contacts found' });

    const totalCost = roundCurrencyAmount(SMS_COST_PER_RECIPIENT * contacts.length);
    const chargeResult = await chargeMarketerForSms(req.userId, contacts.length);
    if (!chargeResult) {
      return res.status(402).json({
        success: false,
        message: `Insufficient balance. Sending to ${contacts.length} recipients costs ₦${totalCost}. Please fund your wallet.`,
        code: 'INSUFFICIENT_BALANCE',
      });
    }

    const pageCount = countPages(message);
    const results = [];

    const phones = contacts.map(c => c.phone).join(',');
    const providerResult = await sendViaProvider(phones, message.trim(), { customerReference: `BULK_${Date.now()}` }).catch(() => null);

    for (const contact of contacts) {
      const status = providerResult ? 'sent' : 'failed';
      const providerId = providerResult?.data?.reference || providerResult?.reference || null;

      try {
        await SmsHistoryModel.create({
          sender: req.userId,
          contact: contact._id,
          message: message.trim(),
          messageLength: message.length,
          pageCount,
          costPerPage: SMS_COST_PER_RECIPIENT,
          totalCost: SMS_COST_PER_RECIPIENT,
          status,
          providerMessageId: providerId,
          phone: contact.phone,
          contactName: contact.displayName,
        });

        results.push({ contactId: contact._id, name: contact.displayName, status });
      } catch (e) {
        results.push({ contactId: contact._id, name: contact.displayName, status: 'failed', error: e.message });
      }
    }

    return res.json({
      success: true,
      data: {
        sent: results.filter(r => r.status === 'sent').length,
        failed: results.filter(r => r.status === 'failed').length,
        totalCost,
        results,
      },
      message: `SMS sent to ${contacts.length} customers. ₦${totalCost} deducted from your wallet.`,
      balance: chargeResult.newBalance,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};
