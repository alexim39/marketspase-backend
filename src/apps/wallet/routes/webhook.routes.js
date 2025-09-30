import express from 'express';
import { handleTransferWebhook } from '../services/transfer-webhook.js';
import crypto from 'crypto';

const router = express.Router();

// Paystack webhook endpoint
router.post('/paystack/transfer', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    // Validate webhook signature if secret is set
    if (process.env.PAYSTACK_WEBHOOK_SECRET) {
      const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
      const hash = crypto.createHmac('sha512', secret)
                         .update(req.body)
                         .digest('hex');
      
      if (hash !== req.headers['x-paystack-signature']) {
        console.error('Invalid webhook signature');
        return res.status(401).send('Invalid signature');
      }
    }

    const event = JSON.parse(req.body);
    console.log('Received Paystack webhook:', event.event);

    // Handle the webhook asynchronously (don't block the response)
    handleTransferWebhook(event).catch(console.error);

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(400).send('Webhook processing failed');
  }
});

export default router;