import crypto from 'crypto';
import twilio from 'twilio';
import OpenAI from 'openai';
import { AiAssistantRepository } from '../repository/ai-assistant.repository.js';

export class AiAssistantService {
  constructor() {
    this.repository = new AiAssistantRepository();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.encryptionKey = process.env.ENCRYPTION_KEY; // 32 bytes hex
  }

  // --- Encryption helpers (AES-256-GCM) ---
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(this.encryptionKey, 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${encrypted}:${authTag}`;
  }

  decrypt(encryptedText) {
    const [ivHex, enc, authTagHex] = encryptedText.split(':');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(this.encryptionKey, 'hex'),
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(enc, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // --- Twilio client factory ---
  async getTwilioClient(userId) {
    const config = await this.repository.getWhatsAppConfig(userId);
    if (!config) throw new Error('WhatsApp configuration not found');
    const accountSid = this.decrypt(config.twilioAccountSid);
    const authToken = this.decrypt(config.twilioAuthToken);
    return twilio(accountSid, authToken);
  }

  // --- Webhook handler for incoming messages ---
  async handleIncomingMessage({ From, To, Body }) {
    const config = await this.repository.getWhatsAppConfigByPhone(To);
    if (!config) {
      console.warn(`No WhatsApp config for number ${To}`);
      return; // or reply with an error later
    }

    const userId = config.userId;
    const settings = await this.repository.getSettings(userId);

    // Find or create conversation
    const conversation = await this.repository.findOrCreateConversation(userId, From, From);
    // Save the incoming message
    await this.repository.createMessage(conversation._id, {
      direction: 'inbound',
      content: Body,
      source: 'customer',
    });

    // Update conversation meta
    await this.repository.updateConversation(conversation._id, userId, {
      lastMessageText: Body,
      lastMessageAt: new Date(),
    });

    if (!settings.aiEnabled) {
      // AI disabled → do nothing, mark as escalated so user sees it
      await this.repository.updateConversation(conversation._id, userId, {
        status: 'escalated',
      });
      return;
    }

    // Check for escalation keywords (including “human”, “agent”, “speak to someone”)
    const escalateKeywords = ['human', 'agent', 'speak to someone', 'help', 'real person'];
    const lowerBody = Body.toLowerCase();
    const shouldEscalate = escalateKeywords.some(kw => lowerBody.includes(kw));
    if (shouldEscalate) {
      await this.repository.updateConversation(conversation._id, userId, {
        status: 'escalated',
      });
      // Optional AI reply
      await this.sendReply(config, From, conversation._id, 'Let me connect you to our team. One moment please.', 'ai');
      return;
    }

    // Try FAQ matching
    const faqs = await this.repository.findFaqsByUser(userId);
    let matchedFaq = null;
    // Simple exact or case-insensitive substring match
    for (const faq of faqs) {
      if (faq.question.toLowerCase().includes(lowerBody) || lowerBody.includes(faq.question.toLowerCase())) {
        matchedFaq = faq;
        break;
      }
    }

    if (matchedFaq) {
      await this.sendReply(config, From, conversation._id, matchedFaq.answer, 'faq');
    } else {
      // Fallback to OpenAI
      try {
        const reply = await this.getAIResponse(userId, conversation._id, Body, faqs, settings);
        await this.sendReply(config, From, conversation._id, reply, 'ai');
      } catch (error) {
        console.error('OpenAI error:', error);
        // Escalate on failure
        await this.repository.updateConversation(conversation._id, userId, {
          status: 'escalated',
        });
        await this.sendReply(config, From, conversation._id, 'Sorry, I could not process that. A human agent will get back to you shortly.', 'ai');
      }
    }
  }

  // --- Get AI response using OpenAI ---
  async getAIResponse(userId, conversationId, userMessage, faqs, settings) {
    // Build context from FAQs (top 3 that match, or up to 5)
    const relevantFaqs = faqs.slice(0, 5).map(f => `Q: ${f.question}\nA: ${f.answer}`);
    const faqContext = relevantFaqs.join('\n');

    const systemPrompt = `You are a helpful customer support assistant for a Nigerian business.
Tone: ${settings.tone}. Language: ${settings.language === 'pidgin' ? 'Nigerian Pidgin' : 'English'}.
Use the following FAQ knowledge to answer the customer. If the question is not covered, answer politely and suggest the customer to ask for a human agent if needed.
---
${faqContext}
---
Keep responses short and friendly.`;

    // Get last few messages for context
    const messages = await this.repository.findMessagesByConversation(conversationId, 5);
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.direction === 'inbound' ? 'user' : 'assistant',
        content: m.content,
      })),
    ];

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // you can use 'gpt-4o-mini' for cost efficiency
      messages: chatMessages,
      max_tokens: 200,
      temperature: 0.7,
    });

    return completion.choices[0].message.content.trim();
  }

  // --- Send reply via Twilio WhatsApp ---
  async sendReply(config, toNumber, conversationId, body, source) {
    const client = await this.getTwilioClient(config.userId);
    const message = await client.messages.create({
      from: `whatsapp:${config.phoneNumber}`,
      to: `whatsapp:${toNumber}`,
      body,
    });

    // Save outbound message
    await this.repository.createMessage(conversationId, {
      direction: 'outbound',
      content: body,
      source,
    });

    // Update conversation meta
    await this.repository.updateConversation(conversationId, config.userId, {
      lastMessageText: body,
      lastMessageAt: new Date(),
      status: source === 'agent' ? 'active' : undefined, // keep as is or resolved?
    });

    return message;
  }

  // --- Public API methods ---
  async getStats(userId) {
    const convIds = await this.repository.getConversationIdsForUser(userId);
    const totalMessages = convIds.length
      ? await Message.countDocuments({ conversationId: { $in: convIds } })
      : 0;
    const aiHandled = convIds.length
      ? await Message.countDocuments({
          conversationId: { $in: convIds },
          source: { $in: ['ai', 'faq'] },
        })
      : 0;
    const avgResponseTime = await this.repository.getAverageResponseTime(userId);
    return {
      totalMessages,
      aiHandled,
      responseTime: Math.round(avgResponseTime * 10) / 10, // seconds
    };
  }

  async getAllConversations(userId) {
    return this.repository.findConversationsByUser(userId);
  }

  async getConversationMessages(userId, conversationId) {
    const conv = await this.repository.findConversationById(conversationId, userId);
    if (!conv) throw new Error('Conversation not found');
    return this.repository.findMessagesByConversation(conversationId);
  }

  async sendManualReply(userId, conversationId, text) {
    const config = await this.repository.getWhatsAppConfig(userId);
    if (!config) throw new Error('WhatsApp not configured');
    const conv = await this.repository.findConversationById(conversationId, userId);
    if (!conv) throw new Error('Conversation not found');
    return this.sendReply(config, conv.customerWaId, conversationId, text, 'agent');
  }

  async escalateConversation(userId, conversationId) {
    const conv = await this.repository.updateConversation(conversationId, userId, {
      status: 'escalated',
    });
    return conv;
  }

  // FAQ methods
  async getFaqs(userId) {
    return this.repository.findFaqsByUser(userId);
  }

  async addFaq(data) {
    return this.repository.createFaq(userId);
  }

  async updateFaq(userId, faqId, data) {
    return this.repository.updateFaq(faqId, userId, data);
  }

  async deleteFaq(userId, faqId) {
    return this.repository.deleteFaq(faqId, userId);
  }

  // Settings
  async getSettings(userId) {
    return this.repository.getSettings(userId);
  }

  async updateSettings(userId, data) {
    return this.repository.updateSettings(userId, data);
  }

  // Toggle AI
  async toggleAI(userId, enabled) {
    return this.repository.updateSettings(userId, { aiEnabled: enabled });
  }
}