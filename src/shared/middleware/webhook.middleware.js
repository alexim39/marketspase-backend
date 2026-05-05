import twilio from 'twilio';
import { WhatsAppConfig } from '../../apps/ai-assistant/model/index.js';
import { decrypt } from '../../shared/utils/crypto.util.js';
import logger from '../../shared/utils/logger.js';

export const validateTwilioWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-twilio-signature'];
    const url = `${process.env.BASE_URL}/api/v1/ai-assistant/webhook/twilio`;
    
    if (!signature) {
      logger.warn('Twilio webhook missing signature');
      return res.status(403).send('Forbidden');
    }

    const { To } = req.body;
    if (!To) return res.status(400).send('Bad Request');

    const cleanTo = To.replace('whatsapp:', '');
    const config = await WhatsAppConfig.findOne({ phoneNumber: cleanTo, isActive: true });
    
    if (!config) {
      logger.warn(`No active WhatsApp config for ${cleanTo}`);
      return res.status(404).send('Not found');
    }

    const authToken = decrypt(config.twilioAuthToken);
    const isValid = twilio.validateRequest(authToken, signature, url, req.body);
    
    if (!isValid) {
      logger.warn(`Invalid Twilio signature for ${cleanTo}`);
      return res.status(403).send('Forbidden');
    }

    next();
  } catch (err) {
    logger.error('Webhook validation error:', err);
    res.status(500).send('Server Error');
  }
};