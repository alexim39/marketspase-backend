import { AiAssistantSettingsService } from './../../service/settings/settings.service.js';

const settingsService = new AiAssistantSettingsService();

export class AiAssistantSettingsController {
  // WhatsApp
  async getWhatsAppConnections(req, res, next) {
    try {
      const data = await settingsService.getWhatsAppConnections(req.params.userId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async addWhatsAppConnection(req, res, next) {
    try {
      const data = await settingsService.addWhatsAppConnection(
        req.body.userId, // from auth middleware
        req.body.phoneNumber
      );
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async removeWhatsAppConnection(req, res, next) {
    try {
      await settingsService.removeWhatsAppConnection(req.body.userId, req.body.phoneNumber);
      res.json({ success: true, message: 'Removed' });
    } catch (err) { next(err); }
  }

  async toggleAIForConnection(req, res, next) {
    try {
      const data = await settingsService.toggleAIForConnection(
        req.body.userId,
        req.body.phoneNumber,
        req.body.aiEnabled
      );
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async reconnectConnection(req, res, next) {
    try {
      const data = await settingsService.reconnectConnection(req.userId, req.body.phoneNumber);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  // Business
  async getBusinessInfo(req, res, next) {
    try {
      const data = await settingsService.getBusinessInfo(req.params.userId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async updateBusinessInfo(req, res, next) {
    try {
      const data = await settingsService.updateBusinessInfo(req.body.userId, req.body.businessId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  // Notification preferences
  async getNotificationPreferences(req, res, next) {
    try {
      const data = await settingsService.getNotificationPreferences(req.params.userId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async updateNotificationPreferences(req, res, next) {
    try {
      await settingsService.updateNotificationPreferences(req.body.userId, req.body);
      res.json({ success: true });
    } catch (err) { next(err); }
  }

  // Subscription
  async getCurrentPlan(req, res, next) {
    try {
      const planId = await settingsService.getCurrentPlan(req.params.userId);
      const plans = await settingsService.getAvailablePlans();
      res.json({ success: true, data: { planId, plans } });
    } catch (err) { next(err); }
  }

  async getAvailablePlans(req, res, next) {
    try {
      const plans = await settingsService.getAvailablePlans();
      res.json({ success: true, data: plans });
    } catch (err) { next(err); }
  }

  async updateSubscriptionPlan(req, res, next) {
    try {
      await settingsService.updateSubscriptionPlan(req.body.userId, req.body.planId);
      res.json({ success: true });
    } catch (err) { next(err); }
  }
}