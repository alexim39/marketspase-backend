import { getExchangeRates, convertCurrency, formatCurrency } from '../../core/exchange-rate.service.js';

export const currencyMiddleware = async (req, res, next) => {
  try {
    const rates = await getExchangeRates();
    req.rates = rates;
    req.convertCurrency = (amount, from = 'NGN', to) => {
      const userCurrency = req.user?.preferredCurrency || 'NGN';
      return convertCurrency(amount, from, to || userCurrency, rates);
    };
    req.formatCurrency = (amount, currency) => formatCurrency(amount, currency || req.user?.preferredCurrency || 'NGN');
    next();
  } catch { next(); }
};
