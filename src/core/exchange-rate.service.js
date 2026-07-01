import cron from 'node-cron';

const SUPPORTED_CURRENCIES = ['NGN', 'USD', 'GHS', 'KES', 'ZAR', 'XOF'];
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

let cachedRates = null;
let lastFetch = 0;

// Fallback static rates (used when API is unavailable)
const FALLBACK_RATES = {
  NGN: 1,      USD: 0.00065, GHS: 0.0099,
  KES: 0.087,  ZAR: 0.012,   XOF: 0.41,
};

export async function getExchangeRates() {
  const now = Date.now();
  if (cachedRates && (now - lastFetch) < CACHE_TTL) return cachedRates;

  try {
    // Try free ExchangeRate-API (NGN base)
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/NGN');
    const data = await res.json();
    cachedRates = { ...data.rates, NGN: 1 };
    lastFetch = now;
    return cachedRates;
  } catch {
    // Fallback to static rates
    cachedRates = FALLBACK_RATES;
    lastFetch = now;
    return cachedRates;
  }
}

export function convertCurrency(amount, fromCurrency, toCurrency, rates) {
  if (!amount || !fromCurrency || !toCurrency) return amount;
  if (fromCurrency === toCurrency) return amount;
  const fromRate = rates[fromCurrency] || 1;
  const toRate = rates[toCurrency] || 1;
  // Convert via NGN base: amount / fromRate = NGN amount, then * toRate = target currency
  const ngnValue = fromCurrency === 'NGN' ? amount : amount / fromRate;
  const converted = toCurrency === 'NGN' ? ngnValue : ngnValue * toRate;
  return Math.round(converted * 100) / 100;
}

export function formatCurrency(amount, currency = 'NGN') {
  const symbols = { NGN: '₦', USD: '$', GHS: '₵', KES: 'KSh', ZAR: 'R', XOF: 'CFA' };
  const symbol = symbols[currency] || currency;
  const decimals = ['XOF'].includes(currency) ? 0 : 2;
  return `${symbol}${Number(amount).toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function startExchangeRateCron() {
  cron.schedule('*/30 * * * *', async () => {
    try { await getExchangeRates(); } catch {}
  });
  console.log('[CRON] Scheduled: Exchange rate refresh (every 30 min)');
}
