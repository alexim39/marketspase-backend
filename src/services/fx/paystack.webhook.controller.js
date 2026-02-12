// controllers/paystack.webhook.controller.js
import crypto from 'crypto';
import { creditWalletWithTx } from './wallet.service.js';
import { toNGNMinorFrom } from './money.util.js';
import { UserModel } from '../../apps/user/models/user.model.js';

const PAYSTACK_SIGNATURE_HEADER = 'x-paystack-signature';
const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET;

function verifySignature(rawBody, signature) {
  const hash = crypto.createHmac('sha512', PAYSTACK_WEBHOOK_SECRET)
                     .update(rawBody, 'utf8')
                     .digest('hex');
  return hash === signature;
}

export async function handlePaystackWebhook(req, res) {
  const sig = req.headers[PAYSTACK_SIGNATURE_HEADER];
  const raw = req.rawBody || JSON.stringify(req.body);
  if (!verifySignature(raw, sig)) return res.status(401).send('invalid-signature');

  const event = req.body?.event;
  const data = req.body?.data || {};

  // We handle only charge.success here; add others as needed
  if (event !== 'charge.success') {
    return res.status(200).send('ignored');
  }

  try {
    // Extract values from Paystack payload. Example fields may vary; adjust to your payload.
    const reference = data.reference;
    const gateway = 'paystack';
    const originalCurrency = (data.currency || 'NGN').toUpperCase();
    const originalAmountMinor = Number(data.amount); // Paystack amounts are minor units
    const feeMinor = Number(data.fees ?? 0);

    // Paystack often includes conversion rate; if not, fetch from verify API (not shown here).
    const rateToNGN = Number(
      data?.metadata?.fx_rate_to_ngn ??
      data?.exchange_rate ??
      data?.channel_exchange_rate ??  // pick your actual field names
      1
    );

    // Compute NGN credit in kobo
    const ngnGrossMinor = toNGNMinorFrom(originalAmountMinor, originalCurrency, rateToNGN);
    const ngnFeeMinor   = toNGNMinorFrom(feeMinor, originalCurrency, rateToNGN);
    const ngnNetMinor   = ngnGrossMinor - ngnFeeMinor;

    // Resolve the credited user (from your own metadata)
    const userId = data?.metadata?.userId; // you already send userId on initialize
    const role   = data?.metadata?.role || 'marketer'; // or 'promoter' depending on your flow

    // Build the transaction (legacy-compatible)
    const tx = {
      reference,
      gateway,
      currency: originalCurrency,        // store original currency per your schema
      amount: originalAmountMinor / 100, // legacy major (for UI) – safe since you already use it
      fee:    feeMinor / 100,
      amountPayable: ngnNetMinor / 100,  // NGN major (optional legacy field you already have) [2](https://saipem-my.sharepoint.com/personal/alex_imenwo_saipem_com1/Documents/Microsoft%20Copilot%20Chat%20Files/transaction.schema.js)
      type: 'credit',
      category: 'deposit',
      status: 'successful',
      description: `Deposit via Paystack (${originalCurrency})`,
      meta: {
        fx: {
          sourceCurrency: originalCurrency,
          targetCurrency: 'NGN',
          rate: rateToNGN,
          provider: 'gateway',
          asOf: new Date().toISOString()
        },
        raw: {
          channel: data.channel,
          auth: data.authorization?.authorization_code ?? null
        }
      },
      processedAt: new Date()
    };

    await creditWalletWithTx({
      userId, role,
      amountNgnMinor: ngnNetMinor,
      tx
    });

    return res.status(200).send('ok');
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).send('error');
  }
}