import { normalizeCurrencyCode, roundCurrencyAmount } from './payment-currency.service.js';

const isMapLike = (value) => Boolean(
  value
  && typeof value === 'object'
  && typeof value.entries === 'function'
);

const cloneAmountMap = (mapLike = {}) => {
  if (mapLike instanceof Map || isMapLike(mapLike)) {
    return Object.fromEntries(Array.from(mapLike.entries()));
  }

  if (typeof mapLike?.toObject === 'function') {
    return { ...(mapLike.toObject() || {}) };
  }

  return { ...(mapLike || {}) };
};

const setWalletField = (wallet, key, value) => {
  if (!wallet) return;

  if (typeof wallet.set === 'function') {
    wallet.set(key, value);
    return;
  }

  wallet[key] = value;
};

const getMapKey = (bucket = 'balance') => bucket === 'reserved'
  ? 'reservedByCurrency'
  : 'balancesByCurrency';

export const ensureWalletCurrencyState = (wallet, baseCurrency = 'NGN') => {
  if (!wallet) {
    return null;
  }

  const normalizedBase = normalizeCurrencyCode(baseCurrency, 'NGN');
  const normalizedWalletCurrency = normalizeCurrencyCode(wallet.currency || normalizedBase, normalizedBase);
  const normalizedWalletBase = normalizeCurrencyCode(wallet.baseCurrency || normalizedBase, normalizedBase);
  const balancesByCurrency = cloneAmountMap(wallet.balancesByCurrency);
  const reservedByCurrency = cloneAmountMap(wallet.reservedByCurrency);

  balancesByCurrency[normalizedWalletBase] = roundCurrencyAmount(Number(wallet.balance || 0));
  reservedByCurrency[normalizedWalletBase] = roundCurrencyAmount(Number(wallet.reserved || 0));

  setWalletField(wallet, 'currency', normalizedWalletCurrency);
  setWalletField(wallet, 'baseCurrency', normalizedWalletBase);
  setWalletField(wallet, 'balancesByCurrency', balancesByCurrency);
  setWalletField(wallet, 'reservedByCurrency', reservedByCurrency);
  return wallet;
};

export const getWalletAmountForCurrency = (wallet, bucket = 'balance', currency = null) => {
  if (!wallet) return 0;
  const normalizedCurrency = normalizeCurrencyCode(currency || wallet.baseCurrency || wallet.currency || 'NGN');
  const mapKey = getMapKey(bucket);
  const amountMap = cloneAmountMap(wallet[mapKey]);

  if (normalizedCurrency === normalizeCurrencyCode(wallet.baseCurrency || wallet.currency || 'NGN')) {
    return roundCurrencyAmount(bucket === 'reserved' ? wallet.reserved : wallet.balance);
  }

  return roundCurrencyAmount(amountMap[normalizedCurrency] || 0);
};

export const applyWalletCredit = (wallet, {
  bucket = 'balance',
  amount = 0,
  currency = null,
  baseAmount = null,
  baseCurrency = null,
}) => {
  const state = ensureWalletCurrencyState(wallet, baseCurrency);
  if (!state) return state;

  const normalizedCurrency = normalizeCurrencyCode(currency || state.baseCurrency, state.baseCurrency);
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency || state.baseCurrency, state.baseCurrency);
  const nativeAmount = roundCurrencyAmount(amount);
  const convertedBaseAmount = roundCurrencyAmount(baseAmount ?? nativeAmount);
  const mapKey = getMapKey(bucket);
  const scalarKey = bucket === 'reserved' ? 'reserved' : 'balance';
  const amountMap = cloneAmountMap(state[mapKey]);

  amountMap[normalizedCurrency] = roundCurrencyAmount(Number(amountMap[normalizedCurrency] || 0) + nativeAmount);
  amountMap[normalizedBaseCurrency] = roundCurrencyAmount(Number(amountMap[normalizedBaseCurrency] || 0) + convertedBaseAmount);

  setWalletField(state, mapKey, amountMap);
  setWalletField(state, scalarKey, roundCurrencyAmount(Number(state[scalarKey] || 0) + convertedBaseAmount));
  setWalletField(state, 'baseCurrency', normalizedBaseCurrency);
  return state;
};

export const applyWalletDebit = (wallet, {
  bucket = 'balance',
  amount = 0,
  currency = null,
  baseAmount = null,
  baseCurrency = null,
}) => {
  const state = ensureWalletCurrencyState(wallet, baseCurrency);
  if (!state) return state;

  const normalizedCurrency = normalizeCurrencyCode(currency || state.baseCurrency, state.baseCurrency);
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency || state.baseCurrency, state.baseCurrency);
  const nativeAmount = roundCurrencyAmount(amount);
  const convertedBaseAmount = roundCurrencyAmount(baseAmount ?? nativeAmount);
  const mapKey = getMapKey(bucket);
  const scalarKey = bucket === 'reserved' ? 'reserved' : 'balance';
  const amountMap = cloneAmountMap(state[mapKey]);
  const currentNative = roundCurrencyAmount(Number(amountMap[normalizedCurrency] || 0));
  const currentBase = roundCurrencyAmount(Number(amountMap[normalizedBaseCurrency] || 0));

  if (currentNative + 0.0001 < nativeAmount) {
    throw Object.assign(new Error(`Insufficient ${bucket} balance in ${normalizedCurrency}`), { status: 400 });
  }

  if (currentBase + 0.0001 < convertedBaseAmount) {
    throw Object.assign(new Error(`Insufficient ${bucket} balance in ${normalizedBaseCurrency}`), { status: 400 });
  }

  amountMap[normalizedCurrency] = roundCurrencyAmount(Math.max(0, currentNative - nativeAmount));
  amountMap[normalizedBaseCurrency] = roundCurrencyAmount(Math.max(0, currentBase - convertedBaseAmount));
  setWalletField(state, mapKey, amountMap);
  setWalletField(state, scalarKey, roundCurrencyAmount(Math.max(0, Number(state[scalarKey] || 0) - convertedBaseAmount)));
  setWalletField(state, 'baseCurrency', normalizedBaseCurrency);
  return state;
};

export const moveWalletReservedToBalance = (wallet, {
  amount = 0,
  currency = null,
  baseAmount = null,
  baseCurrency = null,
}) => {
  applyWalletDebit(wallet, {
    bucket: 'reserved',
    amount,
    currency,
    baseAmount,
    baseCurrency,
  });

  applyWalletCredit(wallet, {
    bucket: 'balance',
    amount,
    currency,
    baseAmount,
    baseCurrency,
  });

  return wallet;
};

export const serializeWalletBalances = (wallet) => {
  if (!wallet) {
    return {
      baseCurrency: 'NGN',
      balance: 0,
      reserved: 0,
      balancesByCurrency: { NGN: 0 },
      reservedByCurrency: { NGN: 0 },
    };
  }

  const state = ensureWalletCurrencyState(wallet, wallet.baseCurrency || wallet.currency || 'NGN');
  return {
    baseCurrency: state.baseCurrency,
    balance: roundCurrencyAmount(state.balance || 0),
    reserved: roundCurrencyAmount(state.reserved || 0),
    balancesByCurrency: cloneAmountMap(state.balancesByCurrency),
    reservedByCurrency: cloneAmountMap(state.reservedByCurrency),
  };
};

