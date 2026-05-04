import { Router } from 'express';
import { AiAssistantController } from './ai-assistant.controller.js';
import { validate } from '../../../shared/middleware/validation.middleware.js';
import {
  faqSchema,
  updateFaqSchema,
  settingsSchema,
  toggleSchema,
  sendMessageSchema,
} from './ai-assistant.validation.js';
import settingsRouter from './settings/settings.routes.js';

const router = Router();
const ctrl = new AiAssistantController();

// Mount settings routes
router.use('/settings', settingsRouter);

// Dashboard
router.get('/stats/:userId', ctrl.getStats.bind(ctrl));

// Conversations
router.get('/conversations/:userId', ctrl.getConversations.bind(ctrl));
router.get('/conversations/:id/messages', ctrl.getConversationMessages.bind(ctrl));
router.post('/conversations/:id/messages', validate(sendMessageSchema), ctrl.sendMessage.bind(ctrl));
router.post('/conversations/:id/escalate', ctrl.escalateConversation.bind(ctrl));


// FAQs
router.post('/faqs', validate(faqSchema), ctrl.addFaq.bind(ctrl));
router.put('/faqs/:id', validate(updateFaqSchema), ctrl.updateFaq.bind(ctrl));
router.delete('/faqs/:id', ctrl.deleteFaq.bind(ctrl));
router.get('/faqs/:userId', ctrl.getFaqs.bind(ctrl));


// Settings
router.get('/settings/:userId', ctrl.getSettings.bind(ctrl));
router.put('/settings/:userId', validate(settingsSchema), ctrl.updateSettings.bind(ctrl));

// AI Toggle
router.post('/toggle', validate(toggleSchema), ctrl.toggleAI.bind(ctrl));

// Twilio webhook (should be mounted on a separate public router)
router.post('/webhook/twilio', ctrl.handleWebhook.bind(ctrl));

export default router;