import { UserModel } from '../../user/models/user/index.js';
import { initiateDeposit, verifyDeposit, initiateWithdrawal } from '../../../core/payment-gateway.adapter.js';
import { convertCurrency, getExchangeRates, formatCurrency } from '../../../core/exchange-rate.service.js';

export const fundWallet = async (req, res) => {
  try {
    const { amount, currency } = req.body;
    const country = req.user?.regionalCountry || 'NG';
    const user = await UserModel.findById(req.userId).select('email').lean();

    const result = await initiateDeposit({
      amount, currency: currency || 'NGN', country,
      userId: req.userId, email: user.email,
      callbackUrl: `${process.env.FRONTEND_URL || 'https://marketspase.com'}/dashboard/wallet`,
    });

    if (!result?.data?.authorization_url) {
      return res.status(400).json({ success: false, message: 'Payment gateway initialization failed' });
    }

    return res.json({ success: true, data: { authorization_url: result.data.authorization_url, reference: result.data.reference } });
  } catch (e) {
    console.error('Wallet funding error:', e.message);
    return res.status(500).json({ success: false, message: 'Could not initialize payment' });
  }
};

export const confirmWalletFunding = async (req, res) => {
  try {
    const { reference, country } = req.body;
    const result = await verifyDeposit(reference, country || 'NG');
    if (!result.success) return res.status(400).json({ success: false, message: 'Payment not confirmed' });

    const rates = await getExchangeRates();
    const baseAmount = convertCurrency(result.amount, result.currency, 'NGN', rates);
    await UserModel.updateOne({ _id: req.userId }, {
      $inc: { 'wallets.marketer.balance': baseAmount },
      $push: { 'wallets.marketer.transactions': { amount: baseAmount, type: 'credit', category: 'deposit', status: 'completed', currency: result.currency, displayAmount: result.amount, createdAt: new Date() } },
    });

    return res.json({ success: true, data: { baseAmount, displayAmount: result.amount, currency: result.currency } });
  } catch (e) {
    console.error('Wallet funding confirm error:', e.message);
    return res.status(500).json({ success: false, message: 'Could not confirm payment' });
  }
};

export const withdrawFunds = async (req, res) => {
  try {
    const { amount, bankCode, accountNumber, accountName, currency } = req.body;
    const country = req.user?.regionalCountry || 'NG';
    const user = await UserModel.findById(req.userId).select('wallets').lean();
    const wallet = user?.wallets?.marketer || user?.wallets?.promoter;
    const walletRole = user?.wallets?.promoter?.balance > 0 ? 'promoter' : 'marketer';

    if ((wallet?.balance || 0) < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    const reference = `WTH-${Date.now()}-${req.userId.toString().slice(-6)}`;
    const result = await initiateWithdrawal({ amount, currency: currency || 'NGN', country, bankCode, accountNumber, accountName, reference });
    if (!result?.data?.status && !result?.data?.id) {
      return res.status(400).json({ success: false, message: 'Withdrawal failed: ' + (result?.message || 'Gateway error') });
    }

    const rates = await getExchangeRates();
    const displayAmount = convertCurrency(amount, 'NGN', currency || 'NGN', rates);
    await UserModel.updateOne({ _id: req.userId }, {
      $inc: { [`wallets.${walletRole}.balance`]: -amount },
      $push: { [`wallets.${walletRole}.transactions`]: { amount, type: 'debit', category: 'withdrawal', status: 'processing', currency, displayAmount, reference, bankDetails: { bank: bankCode, accountNumber, accountName }, createdAt: new Date() } },
    });

    return res.json({ success: true, data: { reference, displayAmount, currency } });
  } catch (e) {
    console.error('Withdrawal error:', e.message);
    return res.status(500).json({ success: false, message: 'Could not process withdrawal' });
  }
};

export const getWalletWithRates = async (req, res) => {
  try {
    const user = await UserModel.findById(req.userId).select('wallets preferredCurrency regionalCountry').lean();
    const rates = await getExchangeRates();
    const currency = user?.preferredCurrency || 'NGN';
    const mBalance = user?.wallets?.marketer?.balance || 0;
    const mReserved = user?.wallets?.marketer?.reserved || 0;
    const pBalance = user?.wallets?.promoter?.balance || 0;
    const pReserved = user?.wallets?.promoter?.reserved || 0;

    return res.json({ success: true, data: {
      marketer: { balance: mBalance, displayBalance: convertCurrency(mBalance, 'NGN', currency, rates), reserved: mReserved, displayReserved: convertCurrency(mReserved, 'NGN', currency, rates) },
      promoter: { balance: pBalance, displayBalance: convertCurrency(pBalance, 'NGN', currency, rates), reserved: pReserved, displayReserved: convertCurrency(pReserved, 'NGN', currency, rates) },
      currency, rates: Object.fromEntries(['NGN','USD','GHS','KES','ZAR','XOF'].map(c => [c, rates[c]])),
    }});
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};
