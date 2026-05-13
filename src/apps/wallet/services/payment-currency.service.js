import axios from 'axios';
import crypto from 'crypto';
import { PaymentCurrencyConfigModel } from '../models/payment-currency-config.model.js';

const DEFAULT_KEY = 'default';
const EXCHANGE_RATE_API_URL = process.env.EXCHANGE_RATE_API_URL || 'https://api.exchangerate.host/latest';
const QUOTE_SECRET = process.env.ENCRYPTION_KEY || process.env.JWTTOKENSECRET || 'marketspase-payment-quote-secret';

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const normalizeCurrency = (currency, fallback = 'NGN') => String(currency || fallback).trim().toUpperCase();

const cloneMapObject = (mapValue = {}) => {
  if (mapValue instanceof Map) {
    return Object.fromEntries(mapValue.entries());
  }
  return { ...(mapValue || {}) };
};

const sortSupportedCurrencies = (currencies = []) => [...currencies]
  .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));

export const getOrCreatePaymentCurrencyConfig = async () => {
  let config = await PaymentCurrencyConfigModel.findOne({ key: DEFAULT_KEY });
  if (!config) {
    config = await PaymentCurrencyConfigModel.create({ key: DEFAULT_KEY });
  }
  return config;
};

export const serializePaymentCurrencyConfig = (config) => {
  const configObject = config?.toObject ? config.toObject() : config;
  const baseCurrency = normalizeCurrency(configObject?.baseCurrency, 'NGN');
  const rates = cloneMapObject(configObject?.rates);

  rates[baseCurrency] = Number(rates[baseCurrency] || 1);

  return {
    ...configObject,
    key: configObject?.key || DEFAULT_KEY,
    baseCurrency,
    ratesSource: configObject?.ratesSource || 'manual',
    refreshIntervalMinutes: Number(configObject?.refreshIntervalMinutes || 60),
    quoteLockMinutes: Number(configObject?.quoteLockMinutes || 30),
    supportedCurrencies: sortSupportedCurrencies(configObject?.supportedCurrencies || []).map((currency) => ({
      ...currency,
      code: normalizeCurrency(currency.code),
      capabilities: {
        display: Boolean(currency?.capabilities?.display),
        deposit: Boolean(currency?.capabilities?.deposit),
        checkout: Boolean(currency?.capabilities?.checkout),
        withdrawal: Boolean(currency?.capabilities?.withdrawal),
      },
      paystackChargeSupported: Boolean(currency?.paystackChargeSupported),
      paystackTransferSupported: Boolean(currency?.paystackTransferSupported),
    })),
    rates,
  };
};

const signQuotePayload = (payload) => crypto
  .createHmac('sha256', QUOTE_SECRET)
  .update(JSON.stringify(payload))
  .digest('hex');

const extractRequestedCurrencies = (config) => {
  const supported = serializePaymentCurrencyConfig(config).supportedCurrencies;
  const currencyCodes = new Set([normalizeCurrency(config.baseCurrency)]);

  supported.forEach((currency) => {
    if (currency.capabilities.display || currency.capabilities.deposit || currency.capabilities.checkout) {
      currencyCodes.add(currency.code);
    }
  });

  return [...currencyCodes];
};

export const refreshExchangeRatesIfNeeded = async (config, { force = false } = {}) => {
  const normalizedConfig = serializePaymentCurrencyConfig(config);
  if (normalizedConfig.ratesSource !== 'exchangerate_host') {
    return normalizedConfig;
  }

  const lastFetchedAt = normalizedConfig.lastFetchedAt ? new Date(normalizedConfig.lastFetchedAt) : null;
  const refreshWindowMs = Number(normalizedConfig.refreshIntervalMinutes || 60) * 60 * 1000;
  const isFresh = lastFetchedAt && (Date.now() - lastFetchedAt.getTime()) < refreshWindowMs;

  if (!force && isFresh) {
    return normalizedConfig;
  }

  const symbols = extractRequestedCurrencies(normalizedConfig)
    .filter((code) => code !== normalizedConfig.baseCurrency)
    .join(',');

  try {
    const response = await axios.get(EXCHANGE_RATE_API_URL, {
      params: {
        base: normalizedConfig.baseCurrency,
        symbols,
      },
      timeout: 15000,
    });

    const apiRates = response.data?.rates || {};
    const nextRates = {
      ...cloneMapObject(normalizedConfig.rates),
      [normalizedConfig.baseCurrency]: 1,
    };

    Object.entries(apiRates).forEach(([code, rate]) => {
      const normalizedCode = normalizeCurrency(code);
      const numericRate = Number(rate);
      if (Number.isFinite(numericRate) && numericRate > 0) {
        nextRates[normalizedCode] = numericRate;
      }
    });

    config.rates = nextRates;
    config.lastFetchedAt = new Date();
    await config.save();

    return serializePaymentCurrencyConfig(config);
  } catch (error) {
    console.warn('Payment FX rate refresh failed:', error.response?.data || error.message);
    return normalizedConfig;
  }
};

export const getPaymentCurrencyConfig = async ({ forceRefresh = false } = {}) => {
  const config = await getOrCreatePaymentCurrencyConfig();
  return refreshExchangeRatesIfNeeded(config, { force: forceRefresh });
};

const getRateFromBase = (config, currency) => {
  const normalized = normalizeCurrency(currency, config.baseCurrency);
  const rates = cloneMapObject(config.rates);
  if (normalized === config.baseCurrency) {
    return 1;
  }
  const rate = Number(rates[normalized]);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw Object.assign(new Error(`No exchange rate configured for ${normalized}`), { status: 400 });
  }
  return rate;
};

export const convertAmount = (amount, fromCurrency, toCurrency, config) => {
  const normalizedConfig = serializePaymentCurrencyConfig(config);
  const sourceCurrency = normalizeCurrency(fromCurrency, normalizedConfig.baseCurrency);
  const targetCurrency = normalizeCurrency(toCurrency, normalizedConfig.baseCurrency);
  const numericAmount = Number(amount || 0);

  if (!Number.isFinite(numericAmount)) {
    throw Object.assign(new Error('Invalid amount for conversion'), { status: 400 });
  }

  if (sourceCurrency === targetCurrency) {
    return {
      amount: roundMoney(numericAmount),
      rate: 1,
      baseAmount: sourceCurrency === normalizedConfig.baseCurrency
        ? roundMoney(numericAmount)
        : roundMoney(numericAmount / getRateFromBase(normalizedConfig, sourceCurrency)),
    };
  }

  const sourceRate = getRateFromBase(normalizedConfig, sourceCurrency);
  const targetRate = getRateFromBase(normalizedConfig, targetCurrency);
  const baseAmount = sourceCurrency === normalizedConfig.baseCurrency
    ? numericAmount
    : numericAmount / sourceRate;
  const converted = targetCurrency === normalizedConfig.baseCurrency
    ? baseAmount
    : baseAmount * targetRate;

  return {
    amount: roundMoney(converted),
    rate: roundMoney(converted / Math.max(numericAmount, 0.000001)),
    baseAmount: roundMoney(baseAmount),
  };
};

export const buildSignedQuote = async ({
  amount,
  fromCurrency,
  toCurrency,
  purpose = 'general',
  forceRefresh = false,
}) => {
  const config = await getPaymentCurrencyConfig({ forceRefresh });
  const sourceCurrency = normalizeCurrency(fromCurrency, config.baseCurrency);
  const targetCurrency = normalizeCurrency(toCurrency, sourceCurrency);
  const numericAmount = roundMoney(amount);

  if (numericAmount <= 0) {
    throw Object.assign(new Error('Amount must be greater than zero'), { status: 400 });
  }

  const conversion = convertAmount(numericAmount, sourceCurrency, targetCurrency, config);
  const quotedAt = new Date();
  const expiresAt = new Date(quotedAt.getTime() + (Number(config.quoteLockMinutes || 30) * 60 * 1000));

  const payload = {
    purpose,
    baseCurrency: config.baseCurrency,
    sourceCurrency,
    sourceAmount: roundMoney(numericAmount),
    targetCurrency,
    targetAmount: roundMoney(conversion.amount),
    baseAmount: roundMoney(conversion.baseAmount),
    exchangeRate: Number(conversion.rate),
    quotedAt: quotedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    ratesSource: config.ratesSource,
  };

  const signature = signQuotePayload(payload);

  return {
    ...payload,
    signature,
    supportedCurrencies: config.supportedCurrencies,
    lastFetchedAt: config.lastFetchedAt || null,
  };
};

export const verifySignedQuote = async (quote, { purpose = null } = {}) => {
  if (!quote || typeof quote !== 'object') {
    throw Object.assign(new Error('Missing currency quote'), { status: 400 });
  }

  const payload = {
    purpose: quote.purpose,
    baseCurrency: normalizeCurrency(quote.baseCurrency),
    sourceCurrency: normalizeCurrency(quote.sourceCurrency),
    sourceAmount: roundMoney(quote.sourceAmount),
    targetCurrency: normalizeCurrency(quote.targetCurrency),
    targetAmount: roundMoney(quote.targetAmount),
    baseAmount: roundMoney(quote.baseAmount),
    exchangeRate: Number(quote.exchangeRate),
    quotedAt: new Date(quote.quotedAt).toISOString(),
    expiresAt: new Date(quote.expiresAt).toISOString(),
    ratesSource: quote.ratesSource || 'manual',
  };

  const expectedSignature = signQuotePayload(payload);
  if (expectedSignature !== quote.signature) {
    throw Object.assign(new Error('Currency quote signature is invalid'), { status: 400 });
  }

  if (purpose && payload.purpose !== purpose) {
    throw Object.assign(new Error('Currency quote purpose does not match this request'), { status: 400 });
  }

  if (Number.isNaN(new Date(payload.expiresAt).getTime()) || new Date(payload.expiresAt) < new Date()) {
    throw Object.assign(new Error('Currency quote has expired. Please refresh and try again.'), { status: 400 });
  }

  return payload;
};

export const getSupportedCurrenciesForCapability = async (capability = 'display') => {
  const config = await getPaymentCurrencyConfig();
  return config.supportedCurrencies
    .filter((currency) => Boolean(currency?.capabilities?.[capability]));
};

export const updatePaymentCurrencyConfig = async (payload = {}, adminUserId = null) => {
  const config = await getOrCreatePaymentCurrencyConfig();
  const baseCurrency = normalizeCurrency(payload.baseCurrency || config.baseCurrency, 'NGN');

  config.baseCurrency = baseCurrency;
  config.ratesSource = ['manual', 'exchangerate_host'].includes(payload.ratesSource)
    ? payload.ratesSource
    : config.ratesSource;
  config.refreshIntervalMinutes = Math.max(5, Math.min(1440, Number(payload.refreshIntervalMinutes || config.refreshIntervalMinutes || 60)));
  config.quoteLockMinutes = Math.max(5, Math.min(720, Number(payload.quoteLockMinutes || config.quoteLockMinutes || 30)));

  if (Array.isArray(payload.supportedCurrencies) && payload.supportedCurrencies.length > 0) {
    config.supportedCurrencies = payload.supportedCurrencies.map((currency, index) => ({
      code: normalizeCurrency(currency.code),
      name: String(currency.name || currency.code || '').trim() || normalizeCurrency(currency.code),
      symbol: String(currency.symbol || '').trim(),
      capabilities: {
        display: Boolean(currency?.capabilities?.display),
        deposit: Boolean(currency?.capabilities?.deposit),
        checkout: Boolean(currency?.capabilities?.checkout),
        withdrawal: Boolean(currency?.capabilities?.withdrawal),
      },
      paystackChargeSupported: Boolean(currency?.paystackChargeSupported),
      paystackTransferSupported: Boolean(currency?.paystackTransferSupported),
      sortOrder: Number(currency.sortOrder ?? index),
    }));
  }

  if (payload.rates && typeof payload.rates === 'object') {
    const nextRates = {};
    Object.entries(payload.rates).forEach(([currencyCode, rawRate]) => {
      const normalizedCode = normalizeCurrency(currencyCode);
      const numericRate = Number(rawRate);
      if (Number.isFinite(numericRate) && numericRate > 0) {
        nextRates[normalizedCode] = numericRate;
      }
    });
    nextRates[baseCurrency] = 1;
    config.rates = nextRates;
  } else {
    const existingRates = cloneMapObject(config.rates);
    existingRates[baseCurrency] = 1;
    config.rates = existingRates;
  }

  if (adminUserId) {
    config.lastUpdatedBy = adminUserId;
  }

  await config.save();
  return serializePaymentCurrencyConfig(config);
};

export const getWalletDisplayCurrency = (user, fallbackCurrency = 'NGN') => {
  const preferred = user?.preferences?.financial?.displayCurrency || user?.preferences?.displayCurrency;
  return normalizeCurrency(preferred, fallbackCurrency);
};

export const roundCurrencyAmount = roundMoney;
export const normalizeCurrencyCode = normalizeCurrency;

