import { Router } from 'express';
import { AiAssistantController } from './ai-assistant.controller.js';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';
import { validateTwilioWebhook } from '../../../shared/middleware/webhook.middleware.js';
import { apiLimiter, webhookLimiter } from '../../../shared/middleware/rate-limit.middleware.js';
import { validate } from '../../../shared/middleware/validation.middleware.js';
import {
  faqSchema,
  updateFaqSchema,
  settingsSchema,
  toggleSchema,
  sendMessageSchema,
  templateSchema,
} from './ai-assistant.validation.js';
import settingsRouter from './settings/settings.routes.js';

const router = Router();
const ctrl = new AiAssistantController();

// Public webhook (validated by Twilio signature)
router.post('/webhook/twilio', webhookLimiter, validateTwilioWebhook, ctrl.handleWebhook.bind(ctrl));

// Protected routes
router.use(apiLimiter);
router.use(authenticate);

// Mount settings routes
router.use('/settings', settingsRouter);

// Dashboard
router.get('/stats', ctrl.getStats.bind(ctrl));
router.get('/analytics', ctrl.getAnalytics.bind(ctrl));

// Conversations
router.get('/conversations', ctrl.getConversations.bind(ctrl));
router.get('/conversations/:id/messages', ctrl.getConversationMessages.bind(ctrl));
router.post('/conversations/:id/messages', validate(sendMessageSchema), ctrl.sendMessage.bind(ctrl));
router.post('/conversations/:id/escalate', ctrl.escalateConversation.bind(ctrl));
router.post('/conversations/:id/assign', ctrl.assignConversation.bind(ctrl));
router.post('/conversations/:id/takeover', ctrl.takeoverConversation.bind(ctrl));
router.post('/conversations/:id/resolve', ctrl.resolveConversation.bind(ctrl));
router.post('/conversations/:id/tag', ctrl.tagConversation.bind(ctrl));
router.post('/conversations/:id/quick-action', ctrl.sendQuickAction.bind(ctrl));
router.post('/test', ctrl.testAssistant.bind(ctrl));

// FAQs
router.get('/faqs', ctrl.getFaqs.bind(ctrl));
router.post('/faqs', validate(faqSchema), ctrl.addFaq.bind(ctrl));
router.put('/faqs/:id', validate(updateFaqSchema), ctrl.updateFaq.bind(ctrl));
router.delete('/faqs/:id', ctrl.deleteFaq.bind(ctrl));

// Templates
router.get('/templates', ctrl.getTemplates.bind(ctrl));
router.post('/templates', validate(templateSchema), ctrl.addTemplate.bind(ctrl));
router.put('/templates/:id', validate(templateSchema), ctrl.updateTemplate.bind(ctrl));
router.delete('/templates/:id', ctrl.deleteTemplate.bind(ctrl));

// Settings
router.get('/settings', ctrl.getSettings.bind(ctrl));
router.put('/settings', validate(settingsSchema), ctrl.updateSettings.bind(ctrl));

// AI Toggle
router.post('/toggle', validate(toggleSchema), ctrl.toggleAI.bind(ctrl));

export default router;
