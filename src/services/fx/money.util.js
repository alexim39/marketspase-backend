// services/money.util.js
export const CURRENCY_DECIMALS = { NGN: 2, USD: 2, EUR: 2, GBP: 2 }; // extend as needed

export function toMinor(major, currency = 'NGN') {
  const d = CURRENCY_DECIMALS[currency] ?? 2;
  return Math.round(Number(major) * Math.pow(10, d));
}

export function fromMinor(minor, currency = 'NGN') {
  const d = CURRENCY_DECIMALS[currency] ?? 2;
  return (Number(minor) / Math.pow(10, d));
}

// Gateway FX -> convert an *original* amount to NGN, returning integer kobo
export function toNGNMinorFrom(amountMinor, sourceCurrency, rateToNGN) {
  // rateToNGN is NGN per 1 source currency unit
  const srcDecimals = CURRENCY_DECIMALS[sourceCurrency] ?? 2;
  const srcMajor = Number(amountMinor) / Math.pow(10, srcDecimals);
  const ngnMajor = srcMajor * Number(rateToNGN);
  return toMinor(ngnMajor, 'NGN'); // -> integer kobo
}
``