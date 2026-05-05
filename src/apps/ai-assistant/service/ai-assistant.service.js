import twilio from 'twilio';
import OpenAI from 'openai';
import { AiAssistantRepository } from '../repository/ai-assistant.repository.js';
import { decrypt } from '../../../shared/utils/crypto.util.js';
import logger from '../../../shared/utils/logger.js';
import { cacheService } from '../../../shared/utils/cache.service.js';

export class AiAssistantService {
  constructor() {
    this.repository = new AiAssistantRepository();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async getTwilioClient(userId, phoneNumber = null) {
    let config;
    if (phoneNumber) {
      config = await this.repository.getWhatsAppConfigByPhone(phoneNumber);
    } else {
      config = await this.repository.getWhatsAppConfig(userId);
    }
    if (!config) throw new Error('WhatsApp configuration not found');
    const accountSid = decrypt(config.twilioAccountSid);
    const authToken = decrypt(config.twilioAuthToken);
    return { client: twilio(accountSid, authToken), config };
  }

  async checkSubscriptionAndPlan(userId) {
    const settings = await this.repository.getSettings(userId);
    const now = new Date();
    
    if (!settings.subscription || settings.subscription.status !== 'active' || now > settings.subscription.endDate) {
      throw new Error('Subscription expired or inactive');
    }
    return settings;
  }

  async handleIncomingMessage({ From, To, Body, MessageSid }) {
    // Idempotency: prevent duplicate processing
    const cacheKey = `msg:${MessageSid}`;
    if (cacheService.get(cacheKey)) {
      logger.info(`Duplicate message ${MessageSid} ignored`);
      return null;
    }
    cacheService.set(cacheKey, true, 3600);

    const cleanTo = To.replace('whatsapp:', '');
    const cleanFrom = From.replace('whatsapp:', '');
    
    const config = await this.repository.getWhatsAppConfigByPhone(cleanTo);
    if (!config) {
      logger.warn(`No WhatsApp config for number ${cleanTo}`);
      return null;
    }

    const userId = config.userId.toString();
    
    let settings;
    try {
      settings = await this.checkSubscriptionAndPlan(userId);
    } catch (err) {
      logger.warn(`Subscription check failed for user ${userId}: ${err.message}`);
      return null;
    }

    const conversation = await this.repository.findOrCreateConversation(userId, cleanFrom, cleanFrom);
    
    const savedMessage = await this.repository.createMessage(conversation._id, {
      direction: 'inbound',
      content: Body,
      source: 'customer',
      messageSid: MessageSid,
    });

    await this.repository.updateConversation(conversation._id, userId, {
      lastMessageText: Body,
      lastMessageAt: new Date(),
    });

    if (!settings.aiEnabled) {
      await this.repository.updateConversation(conversation._id, userId, { status: 'escalated' });
      return { userId, conversationId: conversation._id.toString(), message: savedMessage };
    }

    // Escalation keywords
    const escalateKeywords = ['human', 'agent', 'speak to someone', 'help', 'real person', 'manager', 'supervisor'];
    const lowerBody = Body.toLowerCase();
    const shouldEscalate = escalateKeywords.some(kw => lowerBody.includes(kw));
    
    if (shouldEscalate) {
      await this.repository.updateConversation(conversation._id, userId, { status: 'escalated' });
      await this.sendReply(config, cleanFrom, conversation._id, 'Let me connect you to our team. One moment please.', 'ai');
      return { userId, conversationId: conversation._id.toString(), message: savedMessage };
    }

    // FAQ matching
    const faqs = await this.getCachedFaqs(userId);
    let matchedFaq = this.findBestFaqMatch(Body, faqs);

    if (matchedFaq) {
      await this.sendReply(config, cleanFrom, conversation._id, matchedFaq.answer, 'faq');
    } else {
      // OpenAI fallback
      try {
        const reply = await this.getAIResponse(userId, conversation._id, Body, faqs, settings);
        await this.sendReply(config, cleanFrom, conversation._id, reply, 'ai');
      } catch (error) {
        logger.error('OpenAI error:', error);
        await this.repository.updateConversation(conversation._id, userId, { status: 'escalated' });
        await this.sendReply(config, cleanFrom, conversation._id, 'Sorry, I could not process that. A human agent will get back to you shortly.', 'ai');
      }
    }

    return { userId, conversationId: conversation._id.toString(), message: savedMessage };
  }

  findBestFaqMatch(query, faqs) {
    const lowerQuery = query.toLowerCase().trim();
    const queryWords = lowerQuery.split(/\s+/);
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const faq of faqs) {
      const lowerQuestion = faq.question.toLowerCase();
      
      if (lowerQuestion === lowerQuery) return faq;
      if (lowerQuestion.includes(lowerQuery) || lowerQuery.includes(lowerQuestion)) return faq;
      
      const questionWords = lowerQuestion.split(/\s+/);
      const overlap = queryWords.filter(w => questionWords.includes(w)).length;
      const score = overlap / Math.max(queryWords.length, questionWords.length);
      
      if (score > 0.6 && score > bestScore) {
        bestScore = score;
        bestMatch = faq;
      }
    }
    return bestMatch;
  }

  async getCachedFaqs(userId) {
    const cacheKey = `faqs:${userId}`;
    let faqs = cacheService.get(cacheKey);
    if (!faqs) {
      faqs = await this.repository.findFaqsByUser(userId);
      cacheService.set(cacheKey, faqs, 300);
    }
    return faqs;
  }

  async getAIResponse(userId, conversationId, userMessage, faqs, settings) {
    const isAdvanced = settings.subscription?.planId === 'advanced';
    
    const relevantFaqs = faqs.slice(0, 3).map(f => `Q: ${f.question}\nA: ${f.answer}`);
    const faqContext = relevantFaqs.join('\n');

    let systemPrompt = `You are a helpful customer support assistant for a Nigerian business.
Tone: ${settings.tone || 'friendly'}. Language: ${settings.language === 'pidgin' ? 'Nigerian Pidgin' : 'English'}.
Use the following FAQ knowledge to answer the customer. If the question is not covered, answer politely and suggest the customer to ask for a human agent if needed.
---
${faqContext}
---
Keep responses short and friendly.`;

    if (isAdvanced) {
      systemPrompt += `\n\nYou are on the ADVANCED plan. Actively promote products when relevant, suggest complementary items, and guide customers toward making a purchase. Include a subtle call-to-action when appropriate.`;
    }

    const messages = await this.repository.findMessagesByConversation(conversationId, 10);
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.direction === 'inbound' ? 'user' : 'assistant',
        content: m.content,
      })),
    ];

    const completion = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: chatMessages,
      max_tokens: 250,
      temperature: 0.7,
    });

    return completion.choices[0].message.content.trim();
  }

  async sendReply(config, toNumber, conversationId, body, source) {
    const { client } = await this.getTwilioClient(config.userId, config.phoneNumber);
    const message = await client.messages.create({
      from: `whatsapp:${config.phoneNumber}`,
      to: `whatsapp:${toNumber}`,
      body,
    });

    await this.repository.createMessage(conversationId, {
      direction: 'outbound',
      content: body,
      source,
      messageSid: message.sid,
    });

    const updateData = { lastMessageText: body, lastMessageAt: new Date() };
    if (source === 'agent') updateData.status = 'active';
    await this.repository.updateConversation(conversationId, config.userId, updateData);

    return message;
  }

  async getStats(userId) {
    const totalMessages = await this.repository.getTotalMessages(userId);
    const aiHandled = await this.repository.getMessageCountBySource(userId, ['ai', 'faq']);
    const avgResponseTime = await this.repository.getAverageResponseTime(userId);
    const escalatedCount = await this.repository.countConversationsByStatus(userId, 'escalated');
    const activeCount = await this.repository.countConversationsByStatus(userId, 'active');
    
    return {
      totalMessages,
      aiHandled,
      humanHandled: totalMessages - aiHandled,
      responseTime: Math.round(avgResponseTime * 10) / 10,
      escalatedCount,
      activeCount,
      conversionRate: totalMessages > 0 ? Math.round((aiHandled / totalMessages) * 100) : 0,
    };
  }

  async getAllConversations(userId, status = null, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    return this.repository.findConversationsByStatus(userId, status, limit, skip);
  }

  async getConversationMessages(userId, conversationId, page = 1, limit = 50) {
    const conv = await this.repository.findConversationById(conversationId, userId);
    if (!conv) throw new Error('Conversation not found');
    return this.repository.findMessagesByConversation(conversationId, limit);
  }

  async sendManualReply(userId, conversationId, text) {
    await this.checkSubscriptionAndPlan(userId);
    const config = await this.repository.getWhatsAppConfig(userId);
    if (!config) throw new Error('WhatsApp not configured');
    const conv = await this.repository.findConversationById(conversationId, userId);
    if (!conv) throw new Error('Conversation not found');
    
    const result = await this.sendReply(config, conv.customerWaId, conversationId, text, 'agent');
    
    await this.repository.createAuditLog({
      userId,
      action: 'send_manual_reply',
      entityType: 'conversation',
      entityId: conversationId,
      details: { text },
      performedBy: userId,
    });
    
    return result;
  }

  async escalateConversation(userId, conversationId) {
    const conv = await this.repository.updateConversation(conversationId, userId, { status: 'escalated' });
    await this.repository.createAuditLog({
      userId,
      action: 'escalate_conversation',
      entityType: 'conversation',
      entityId: conversationId,
      performedBy: userId,
    });
    return conv;
  }

  async assignConversation(userId, conversationId, assigneeId) {
    return this.repository.assignConversation(conversationId, userId, assigneeId);
  }

  async getFaqs(userId) {
    return this.repository.findFaqsByUser(userId);
  }

  async addFaq(userId, data) {
    const faq = await this.repository.createFaq({ userId, ...data });
    cacheService.del(`faqs:${userId}`);
    return faq;
  }

  async updateFaq(userId, faqId, data) {
    const faq = await this.repository.updateFaq(faqId, userId, data);
    cacheService.del(`faqs:${userId}`);
    return faq;
  }

  async deleteFaq(userId, faqId) {
    const result = await this.repository.deleteFaq(faqId, userId);
    cacheService.del(`faqs:${userId}`);
    return result;
  }

  async getSettings(userId) {
    return this.repository.getSettings(userId);
  }

  async updateSettings(userId, data) {
    const updated = await this.repository.updateSettings(userId, data);
    await this.repository.createAuditLog({
      userId,
      action: 'update_settings',
      entityType: 'settings',
      performedBy: userId,
      details: data,
    });
    return updated;
  }

  async toggleAI(userId, enabled) {
    const settings = await this.repository.updateSettings(userId, { aiEnabled: enabled });
    await this.repository.createAuditLog({
      userId,
      action: 'toggle_ai',
      entityType: 'settings',
      performedBy: userId,
      details: { aiEnabled: enabled },
    });
    return settings;
  }

  async getTemplates(userId) {
    return this.repository.findTemplatesByUser(userId);
  }

  async addTemplate(userId, data) {
    return this.repository.createTemplate({ userId, ...data });
  }

  async updateTemplate(userId, templateId, data) {
    return this.repository.updateTemplate(templateId, userId, data);
  }

  async deleteTemplate(userId, templateId) {
    return this.repository.deleteTemplate(templateId, userId);
  }
}