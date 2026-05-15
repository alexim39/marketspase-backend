import { UserModel } from '../../user/models/user/index.js';
import {
  buildSignedQuote,
  getPaymentCurrencyConfig,
  getWalletDisplayCurrency,
  normalizeCurrencyCode,
  updatePaymentCurrencyConfig,
  verifySignedQuote,
} from '../services/payment-currency.service.js';
import {
  convertAmount,
} from '../services/payment-currency.service.js';
import {
  serializeWalletBalances,
} from '../services/wallet-ledger.service.js';

const handleError = (res, error, fallbackMessage) => res.status(error.status || 500).json({
  success: false,
  message: error.message || fallbackMessage,
});

export const getPublicCurrencyConfig = async (_req, res) => {
  try {
    const config = await getPaymentCurrencyConfig();
    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    handleError(res, error, 'Failed to load payment currency configuration');
  }
};

export const getCurrencyQuote = async (req, res) => {
  try {
    const amount = Number(req.query.amount || req.body?.amount || 0);
    const fromCurrency = req.query.from || req.body?.fromCurrency || req.body?.from;
    const toCurrency = req.query.to || req.body?.toCurrency || req.body?.to;
    const purpose = req.query.purpose || req.body?.purpose || 'general';
    const quote = await buildSignedQuote({
      amount,
      fromCurrency,
      toCurrency,
      purpose,
    });

    res.status(200).json({
      success: true,
      data: quote,
    });
  } catch (error) {
    handleError(res, error, 'Failed to build currency quote');
  }
};

export const getWalletOverview = async (req, res) => {
  try {
    const role = ['promoter', 'marketer'].includes(req.query.role)
      ? req.query.role
      : 'marketer';
    const user = await UserModel.findById(req.userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const config = await getPaymentCurrencyConfig();
    const wallet = user.wallets?.[role];
    const walletState = serializeWalletBalances(wallet);
    const requestedCurrency = req.query.displayCurrency
      ? normalizeCurrencyCode(req.query.displayCurrency, walletState.baseCurrency)
      : getWalletDisplayCurrency(user, walletState.baseCurrency);

    const availableDisplay = convertAmount(walletState.balance, walletState.baseCurrency, requestedCurrency, config);
    const reservedDisplay = convertAmount(walletState.reserved, walletState.baseCurrency, requestedCurrency, config);

    const supportedDisplayCurrencies = config.supportedCurrencies
      .filter((currency) => currency?.capabilities?.display)
      .map((currency) => ({
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
      }));

    const supportedWithdrawalCurrencies = config.supportedCurrencies
      .filter((currency) => currency?.capabilities?.withdrawal)
      .map((currency) => ({
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
      }));

    res.status(200).json({
      success: true,
      data: {
        role,
        baseCurrency: walletState.baseCurrency,
        displayCurrency: requestedCurrency,
        available: {
          baseAmount: walletState.balance,
          displayAmount: availableDisplay.amount,
        },
        reserved: {
          baseAmount: walletState.reserved,
          displayAmount: reservedDisplay.amount,
        },
        balancesByCurrency: walletState.balancesByCurrency,
        reservedByCurrency: walletState.reservedByCurrency,
        supportedDisplayCurrencies,
        supportedWithdrawalCurrencies,
        lastRateRefreshAt: config.lastFetchedAt || null,
      },
    });
  } catch (error) {
    handleError(res, error, 'Failed to load wallet overview');
  }
};

export const updateWalletDisplayCurrency = async (req, res) => {
  try {
    const nextCurrency = normalizeCurrencyCode(req.body?.displayCurrency, 'NGN');
    const config = await getPaymentCurrencyConfig();
    const isSupported = config.supportedCurrencies.some(
      (currency) => currency.code === nextCurrency && currency?.capabilities?.display,
    );

    if (!isSupported) {
      return res.status(400).json({
        success: false,
        message: `${nextCurrency} is not enabled for wallet display`,
      });
    }

    const user = await UserModel.findByIdAndUpdate(
      req.userId,
      { $set: { 'preferences.financial.displayCurrency': nextCurrency } },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Wallet display currency updated',
      data: {
        displayCurrency: nextCurrency,
      },
    });
  } catch (error) {
    handleError(res, error, 'Failed to update wallet display currency');
  }
};

export const getAdminPaymentConfig = async (_req, res) => {
  try {
    const config = await getPaymentCurrencyConfig();
    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    handleError(res, error, 'Failed to load admin payment settings');
  }
};

export const saveAdminPaymentConfig = async (req, res) => {
  try {
    const updatedConfig = await updatePaymentCurrencyConfig(req.body || {}, req.userId);
    res.status(200).json({
      success: true,
      data: updatedConfig,
      message: 'Payment currency settings updated',
    });
  } catch (error) {
    handleError(res, error, 'Failed to update admin payment settings');
  }
};

export const validateQuotePayload = async (req, res) => {
  try {
    const quote = await verifySignedQuote(req.body?.quote, { purpose: req.body?.purpose || null });
    res.status(200).json({
      success: true,
      data: quote,
    });
  } catch (error) {
    handleError(res, error, 'Currency quote validation failed');
  }
};

