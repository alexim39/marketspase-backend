import { convertCurrency, getExchangeRates } from './exchange-rate.service.js';

const GATEWAY_MAP = {
  NG: 'paystack',
  GH: 'paystack',
  KE: 'flutterwave',
  ZA: 'flutterwave',
  DEFAULT: 'paystack',
};

export function getGatewayForCountry(country) {
  return GATEWAY_MAP[country] || GATEWAY_MAP.DEFAULT;
}

export async function initiateDeposit({ amount, currency, country, userId, email, callbackUrl }) {
  const gateway = getGatewayForCountry(country);
  const rates = await getExchangeRates();
  const amountInCurrency = convertCurrency(amount, 'NGN', currency, rates);

  if (gateway === 'paystack') {
    const PAYSTACK_KEY = country === 'GH'
      ? process.env.PAYSTACK_GHANA_SECRET_KEY
      : process.env.PAYSTACK_SECRET_KEY;

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${PAYSTACK_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email, amount: Math.round(amountInCurrency * 100),
        currency,
        reference: `DEP-${Date.now()}-${userId?.toString()?.slice(-6)}`,
        callback_url: callbackUrl,
        metadata: { userId: userId?.toString(), baseAmount: amount, baseCurrency: 'NGN' },
      }),
    });
    return res.json();
  }

  if (gateway === 'flutterwave') {
    const res = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_ref: `DEP-${Date.now()}-${userId?.toString()?.slice(-6)}`,
        amount: amountInCurrency,
        currency,
        email,
        redirect_url: callbackUrl,
        meta: { userId: userId?.toString(), baseAmount: amount, baseCurrency: 'NGN' },
      }),
    });
    return res.json();
  }

  throw new Error(`No gateway configured for country ${country}`);
}

export async function verifyDeposit(reference, country) {
  const gateway = getGatewayForCountry(country);

  if (gateway === 'paystack') {
    const KEY = country === 'GH' ? process.env.PAYSTACK_GHANA_SECRET_KEY : process.env.PAYSTACK_SECRET_KEY;
    const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    const data = await res.json();
    return {
      success: data?.data?.status === 'success',
      amount: (data?.data?.amount || 0) / 100,
      currency: data?.data?.currency || 'NGN',
      gatewayFee: (data?.data?.fees || 0) / 100,
    };
  }

  if (gateway === 'flutterwave') {
    const res = await fetch(`https://api.flutterwave.com/v3/transactions/${reference}/verify`, {
      headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
    });
    const data = await res.json();
    return {
      success: data?.data?.status === 'successful',
      amount: data?.data?.amount || 0,
      currency: data?.data?.currency || 'NGN',
      gatewayFee: data?.data?.app_fee || 0,
    };
  }

  throw new Error(`No verification for country ${country}`);
}

export async function initiateWithdrawal({ amount, currency, country, bankCode, accountNumber, accountName, reference }) {
  const gateway = getGatewayForCountry(country);
  const rates = await getExchangeRates();
  const amountInCurrency = convertCurrency(amount, 'NGN', currency, rates);

  if (gateway === 'paystack') {
    const KEY = country === 'GH' ? process.env.PAYSTACK_GHANA_SECRET_KEY : process.env.PAYSTACK_SECRET_KEY;
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: country === 'GH' ? 'mobile_money' : 'nuban',
        name: accountName, account_number: accountNumber,
        bank_code: bankCode, currency, metadata: { reference },
      }),
    });
    const recipient = await recipientRes.json();
    if (!recipient?.data?.recipient_code) throw new Error('Failed to create transfer recipient');

    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'balance', amount: Math.round(amountInCurrency * 100),
        recipient: recipient.data.recipient_code, currency, reference,
      }),
    });
    return transferRes.json();
  }

  if (gateway === 'flutterwave') {
    const res = await fetch('https://api.flutterwave.com/v3/transfers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_bank: bankCode, account_number: accountNumber,
        amount: amountInCurrency, currency,
        reference, narration: 'MarketSpase withdrawal',
      }),
    });
    return res.json();
  }

  throw new Error(`No withdrawal gateway for country ${country}`);
}
