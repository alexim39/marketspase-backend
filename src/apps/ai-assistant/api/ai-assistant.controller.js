import { AiAssistantService } from '../service/ai-assistant.service.js';
import logger from '../../../shared/utils/logger.js';

const service = new AiAssistantService();

export class AiAssistantController {
  async getStats(req, res, next) {
    try {
      const stats = await service.getStats(req.userId);
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }

  async getConversations(req, res, next) {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      const list = await service.getAllConversations(req.userId, status || null, parseInt(page), parseInt(limit));
      res.json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  }

  async getConversationMessages(req, res, next) {
    try {
      const { page = 1, limit = 50 } = req.query;
      const messages = await service.getConversationMessages(req.userId, req.params.id, parseInt(page), parseInt(limit));
      res.json({ success: true, data: messages });
    } catch (err) {
      next(err);
    }
  }

  async sendMessage(req, res, next) {
    try {
      await service.sendManualReply(req.userId, req.params.id, req.body.text);
      res.json({ success: true, message: 'Message sent' });
    } catch (err) {
      next(err);
    }
  }

  async escalateConversation(req, res, next) {
    try {
      const conv = await service.escalateConversation(req.userId, req.params.id);
      if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found' });
      res.json({ success: true, data: conv });
    } catch (err) {
      next(err);
    }
  }

  async assignConversation(req, res, next) {
    try {
      const conv = await service.assignConversation(req.userId, req.params.id, req.body.assigneeId);
      res.json({ success: true, data: conv });
    } catch (err) {
      next(err);
    }
  }

  async getFaqs(req, res, next) {
    try {
      const faqs = await service.getFaqs(req.userId);
      res.json({ success: true, data: faqs });
    } catch (err) {
      next(err);
    }
  }

  async addFaq(req, res, next) {
    try {
      const faq = await service.addFaq(req.userId, req.body);
      res.status(201).json({ success: true, data: faq });
    } catch (err) {
      next(err);
    }
  }

  async updateFaq(req, res, next) {
    try {
      const faq = await service.updateFaq(req.userId, req.params.id, req.body);
      if (!faq) return res.status(404).json({ success: false, message: 'FAQ not found' });
      res.json({ success: true, data: faq });
    } catch (err) {
      next(err);
    }
  }

  async deleteFaq(req, res, next) {
    try {
      const faq = await service.deleteFaq(req.userId, req.params.id);
      if (!faq) return res.status(404).json({ success: false, message: 'FAQ not found' });
      res.json({ success: true, message: 'FAQ deleted' });
    } catch (err) {
      next(err);
    }
  }

  async getSettings(req, res, next) {
    try {
      const settings = await service.getSettings(req.userId);
      res.json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  }

  async updateSettings(req, res, next) {
    try {
      const updated = await service.updateSettings(req.userId, req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async toggleAI(req, res, next) {
    try {
      const { aiEnabled } = req.body;
      const settings = await service.toggleAI(req.userId, aiEnabled);
      res.json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  }

  async getTemplates(req, res, next) {
    try {
      const templates = await service.getTemplates(req.userId);
      res.json({ success: true, data: templates });
    } catch (err) {
      next(err);
    }
  }

  async addTemplate(req, res, next) {
    try {
      const template = await service.addTemplate(req.userId, req.body);
      res.status(201).json({ success: true, data: template });
    } catch (err) {
      next(err);
    }
  }

  async updateTemplate(req, res, next) {
    try {
      const template = await service.updateTemplate(req.userId, req.params.id, req.body);
      res.json({ success: true, data: template });
    } catch (err) {
      next(err);
    }
  }

  async deleteTemplate(req, res, next) {
    try {
      await service.deleteTemplate(req.userId, req.params.id);
      res.json({ success: true, message: 'Template deleted' });
    } catch (err) {
      next(err);
    }
  }

  async handleWebhook(req, res, next) {
    try {
      const { From, To, Body, MessageSid } = req.body;
      const result = await service.handleIncomingMessage({ From, To, Body, MessageSid });
      
      if (result && req.app.get('io')) {
        const { notifyNewMessage, notifyConversationUpdate } = await import('../socket.handler.js');
        notifyNewMessage(req.app.get('io'), result.userId, result.conversationId, result.message);
      }
      
      res.set('Content-Type', 'text/xml');
      res.send('<Response></Response>');
    } catch (err) {
      logger.error('Webhook error:', err);
      res.status(200).set('Content-Type', 'text/xml').send('<Response></Response>');
    }
  }
}