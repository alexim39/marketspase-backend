// webhook.routes.js
import express from 'express';
import crypto from 'crypto';
import { handleTransferWebhook, handleChargeWebhook } from '../services/transfer-webhook.js';

const router = express.Router();

/**
 * Paystack signs the RAW request body with sha512 using your secret key.
 * We must read raw bytes; ensure this router is mounted BEFORE global express.json().
 *
 * Mounting suggestion in your app entry:
 *   app.use('/api/webhook/paystack', express.raw({ type: 'application/json' }), webhookRouter);
 */
router.post('/paystack/transfer', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Prefer PAYSTACK_WEBHOOK_SECRET if you set it; otherwise use PAYSTACK_SECRET_KEY
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      console.error('Missing PAYSTACK_WEBHOOK_SECRET or PAYSTACK_SECRET_KEY env');
      return res.status(500).send('Webhook secret not configured');
    }

    // Validate signature against RAW body
    const signature = req.headers['x-paystack-signature'];
    const computed = crypto.createHmac('sha512', secret).update(req.body).digest('hex');
    if (!signature || computed !== signature) {
      console.error('Invalid webhook signature');
      // 401 is acceptable; Paystack will retry; this prevents poisoning your endpoint
      return res.status(401).send('Invalid signature');
    }

    // Parse JSON body AFTER signature check
    const event = JSON.parse(req.body);

    // Route by event type (charge.* for deposits; transfer.* for payouts)
    const type = event?.event || '';
    if (type.startsWith('transfer.')) {
      // Non-blocking, idempotent
      handleTransferWebhook(event).catch(err => console.error('transfer webhook error:', err));
    } else if (type === 'charge.success' || type === 'charge.failed') {
      handleChargeWebhook(event).catch(err => console.error('charge webhook error:', err));
    } else {
      console.log('Unhandled Paystack event:', type);
    }

    // Always acknowledge quickly
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still acknowledge to avoid endless retries; recon jobs should clean up
    return res.status(200).json({ received: true });
  }
});

export default router;