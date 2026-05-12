import { AiAssistantSettingsService } from './../../service/settings/settings.service.js';

const settingsService = new AiAssistantSettingsService();
const getRequestUserId = (req) => req.userId || req.user?._id?.toString?.() || req.query?.userId || req.body?.userId || null;

export class AiAssistantSettingsController {
  async getWhatsAppConnections(req, res, next) {
    try {
      const data = await settingsService.getWhatsAppConnections(getRequestUserId(req));
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async addWhatsAppConnection(req, res, next) {
    try {
      const data = await settingsService.addWhatsAppConnection(getRequestUserId(req), req.body.phoneNumber);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  async removeWhatsAppConnection(req, res, next) {
    try {
      await settingsService.removeWhatsAppConnection(getRequestUserId(req), req.body.phoneNumber || req.query.phoneNumber);
      res.json({ success: true, message: 'Removed' });
    } catch (err) { next(err); }
  }

  async toggleAIForConnection(req, res, next) {
    try {
      const data = await settingsService.toggleAIForConnection(getRequestUserId(req), req.body.phoneNumber, req.body.aiEnabled);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async reconnectConnection(req, res, next) {
    try {
      const data = await settingsService.reconnectConnection(getRequestUserId(req), req.body.phoneNumber);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async saveWhatsAppConfig(req, res, next) {
    try {
      const data = await settingsService.saveWhatsAppConfig(getRequestUserId(req), req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async getBusinessInfo(req, res, next) {
    try {
      const data = await settingsService.getBusinessInfo(getRequestUserId(req));
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async updateBusinessInfo(req, res, next) {
    try {
      const data = await settingsService.updateBusinessInfo(getRequestUserId(req), req.body.businessId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async getNotificationPreferences(req, res, next) {
    try {
      const data = await settingsService.getNotificationPreferences(getRequestUserId(req));
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  async updateNotificationPreferences(req, res, next) {
    try {
      await settingsService.updateNotificationPreferences(getRequestUserId(req), req.body);
      res.json({ success: true });
    } catch (err) { next(err); }
  }

  async getCurrentPlan(req, res, next) {
    try {
      const planId = await settingsService.getCurrentPlan(getRequestUserId(req));
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
      await settingsService.updateSubscriptionPlan(getRequestUserId(req), req.body.planId);
      res.json({ success: true, message: 'Subscription updated successfully' });
    } catch (err) { next(err); }
  }
}
