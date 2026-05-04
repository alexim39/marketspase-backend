import { AiAssistantService } from '../service/ai-assistant.service.js';

const service = new AiAssistantService();

export class AiAssistantController {
  // Dashboard stats
  async getStats(req, res, next) {
    try {
      console.log('body:', req.body);
      console.log('query:', req.query);
      console.log('params:', req.params);

      const stats = await service.getStats(req.params.userId); // userId from auth middleware
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }

  // FAQs
  async getFaqs(req, res, next) {
    try {
      const faqs = await service.getFaqs(req.params.userId);
      res.json({ success: true, data: faqs });
    } catch (err) {
      next(err);
    }
  }

  async addFaq(req, res, next) {
    try {
      const faq = await service.addFaq(req.body);
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

  // Conversations
  async getConversations(req, res, next) {
    try {
      const list = await service.getAllConversations(req.params.userId);
      res.json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  }

  async getConversationMessages(req, res, next) {
    try {
      const messages = await service.getConversationMessages(req.params.userId, req.params.id);
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

  // Settings
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

  // Toggle AI
  async toggleAI(req, res, next) {
    try {
      const { aiEnabled } = req.body;
      const settings = await service.toggleAI(req.userId, aiEnabled);
      res.json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  }

  // Twilio webhook (public, verified by signature)
  async handleWebhook(req, res, next) {
    try {
      // Signature validation should be done in middleware or here
      // For simplicity, assume we trust the request (you'd use Twilio middleware)
      const { From, To, Body } = req.body;
      await service.handleIncomingMessage({ From, To, Body });
      // Respond with empty TwiML or empty 200 to avoid retries
      res.set('Content-Type', 'text/xml');
      res.send('<Response></Response>');
    } catch (err) {
      console.error('Webhook error:', err);
      res.status(500).send('<Response></Response>');
    }
  }
}