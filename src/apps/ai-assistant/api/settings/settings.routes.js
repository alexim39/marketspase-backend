import { Router } from 'express';
import { AiAssistantSettingsController } from './settings.controller.js';
import { validate } from '../../../../shared/middleware/validation.middleware.js';
import {
  addWhatsAppSchema,
  removeWhatsAppSchema,
  toggleAiSchema,
  reconnectSchema,
  businessSchema,
  notificationPreferencesSchema,
  subscriptionSchema,
} from './settings.validation.js';

const router = Router();
const ctrl = new AiAssistantSettingsController();

// WhatsApp connections
router.get('/whatsapp/:userId', ctrl.getWhatsAppConnections.bind(ctrl));
router.post('/whatsapp', validate(addWhatsAppSchema), ctrl.addWhatsAppConnection.bind(ctrl));
router.delete('/whatsapp', validate(removeWhatsAppSchema), ctrl.removeWhatsAppConnection.bind(ctrl));
router.put('/whatsapp/toggle-ai', validate(toggleAiSchema), ctrl.toggleAIForConnection.bind(ctrl));
router.post('/whatsapp/reconnect', validate(reconnectSchema), ctrl.reconnectConnection.bind(ctrl));

// Business
router.get('/business/:userId', ctrl.getBusinessInfo.bind(ctrl));
router.put('/business', validate(businessSchema), ctrl.updateBusinessInfo.bind(ctrl));

// Notification preferences
router.get('/notification-preferences/:userId', ctrl.getNotificationPreferences.bind(ctrl));
router.put('/notification-preferences', validate(notificationPreferencesSchema), ctrl.updateNotificationPreferences.bind(ctrl));

// Subscription
router.get('/subscription/plans', ctrl.getAvailablePlans.bind(ctrl));
router.get('/subscription/:userId', ctrl.getCurrentPlan.bind(ctrl));
router.put('/subscription', validate(subscriptionSchema), ctrl.updateSubscriptionPlan.bind(ctrl));

export default router;