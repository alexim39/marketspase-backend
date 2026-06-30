import twilio from 'twilio';
import OpenAI from 'openai';
import { AiAssistantRepository } from '../repository/ai-assistant.repository.js';
import { decrypt } from '../../../shared/utils/crypto.util.js';
import logger from '../../../shared/utils/logger.js';
import { cacheService } from '../../../shared/utils/cache.service.js';

export class AiAssistantService {
  constructor() {
    this.repository = new AiAssistantRepository();
    this.openai = process.env.DEEPSEEK_API_KEY
      ? new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' })
      : null;
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
    
    if (!settings.subscription || settings.subscription.status !== 'active') {
      throw new Error('Subscription expired or inactive');
    }
    if (settings.subscription.endDate && now > settings.subscription.endDate) {
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
      lastMessageSource: 'customer',
      unreadCount: (conversation.unreadCount || 0) + 1,
    });

    if (!settings.aiEnabled || conversation.handledBy === 'human') {
      await this.repository.updateConversation(conversation._id, userId, {
        status: conversation.handledBy === 'human' ? conversation.status : 'escalated',
        handledBy: conversation.handledBy === 'human' ? 'human' : 'human',
        escalationReason: settings.aiEnabled ? conversation.escalationReason : 'AI is turned off',
      });
      return { userId, conversationId: conversation._id.toString(), message: savedMessage };
    }

    // Business hours check — if outside hours, escalate to human with message
    const bizHours = settings.responseSettings?.businessHours;
    if (bizHours?.enabled && bizHours.start && bizHours.end) {
      const now = new Date();
      const tz = bizHours.timezone || 'Africa/Lagos';
      const timeStr = now.toLocaleString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
      const [h, m] = timeStr.split(':').map(Number);
      const nowMins = h * 60 + m;
      const [sh, sm] = bizHours.start.split(':').map(Number);
      const [eh, em] = bizHours.end.split(':').map(Number);
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;
      const inHours = startMins <= endMins ? (nowMins >= startMins && nowMins < endMins) : (nowMins >= startMins || nowMins < endMins);
      if (!inHours) {
        await this.repository.updateConversation(conversation._id, userId, {
          status: 'escalated', handledBy: 'human', escalationReason: 'Outside business hours',
        });
        await this.sendReply(config, cleanFrom, conversation._id, settings.language === 'pidgin' ? 'We don dey close work now. We go respond to your message once we open back. Thank you!' : 'We\'re currently outside business hours. We\'ll respond to your message as soon as we\'re back. Thank you!', 'ai');
        return { userId, conversationId: conversation._id.toString(), message: savedMessage };
      }
    }

    const escalation = this.detectEscalation(Body, settings);
    
    if (escalation.shouldEscalate) {
      await this.repository.updateConversation(conversation._id, userId, {
        status: 'escalated',
        handledBy: 'human',
        priority: escalation.priority,
        leadTag: escalation.leadTag || conversation.leadTag,
        escalationReason: escalation.reason,
      });
      await this.sendReply(config, cleanFrom, conversation._id, this.getEscalationReply(settings), 'ai');
      return { userId, conversationId: conversation._id.toString(), message: savedMessage };
    }

    const maxReplies = settings.responseSettings?.maxAiRepliesBeforeEscalation || 8;
    const aiReplyCount = await this.repository.countMessagesByConversation(conversation._id, ['ai', 'faq']);
    if (aiReplyCount >= maxReplies) {
      await this.repository.updateConversation(conversation._id, userId, {
        status: 'escalated',
        handledBy: 'human',
        escalationReason: 'Maximum AI replies reached',
      });
      await this.sendReply(config, cleanFrom, conversation._id, this.getEscalationReply(settings), 'ai');
      return { userId, conversationId: conversation._id.toString(), message: savedMessage };
    }

    // FAQ matching
    const faqs = await this.getCachedFaqs(userId);
    let matchedFaq = this.findBestFaqMatch(Body, faqs);

    if (matchedFaq) {
      await this.sendReply(config, cleanFrom, conversation._id, this.localizeReply(matchedFaq.answer, settings), 'faq');
    } else {
      // OpenAI fallback
      try {
        const reply = await this.getAIResponse(userId, conversation._id, Body, faqs, settings);
        await this.sendReply(config, cleanFrom, conversation._id, reply, 'ai');
      } catch (error) {
        logger.error('DeepSeek error:', error);
        await this.repository.updateConversation(conversation._id, userId, {
          status: 'escalated',
          handledBy: 'human',
          escalationReason: 'AI response failed',
        });
        await this.sendReply(config, cleanFrom, conversation._id, this.getEscalationReply(settings), 'ai');
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
      const lowerAnswer = faq.answer.toLowerCase();
      const tags = (faq.tags || []).map(tag => tag.toLowerCase());
      
      if (lowerQuestion === lowerQuery) return faq;
      if (lowerQuestion.includes(lowerQuery) || lowerQuery.includes(lowerQuestion)) return faq;
      if (tags.some(tag => lowerQuery.includes(tag))) return faq;
      
      const knowledgeWords = `${lowerQuestion} ${lowerAnswer} ${tags.join(' ')}`.split(/\s+/);
      const meaningfulQueryWords = queryWords.filter(w => w.length > 2);
      const overlap = meaningfulQueryWords.filter(w => knowledgeWords.includes(w)).length;
      const score = overlap / Math.max(meaningfulQueryWords.length || 1, knowledgeWords.length);
      
      if (score > 0.18 && score > bestScore) {
        bestScore = score;
        bestMatch = faq;
      }
    }
    return bestMatch;
  }

  detectEscalation(message, settings) {
    const lower = (message || '').toLowerCase();
    const rules = settings.escalationRules || {};
    const configuredKeywords = Array.isArray(rules.keywords) ? rules.keywords : [];
    const defaultKeywords = ['human', 'agent', 'speak to someone', 'real person', 'manager', 'supervisor'];
    const complaintKeywords = ['complaint', 'angry', 'refund', 'scam', 'bad', 'not working', 'delay', 'delayed'];
    const highValueKeywords = ['bulk', 'wholesale', '100 pieces', 'large order', 'distributor', 'reseller'];

    if ((rules.escalateOnKeywords ?? true) && [...defaultKeywords, ...configuredKeywords].some(kw => lower.includes(kw.toLowerCase()))) {
      return { shouldEscalate: true, reason: 'Customer asked for a human', priority: 'high' };
    }

    if ((rules.complaints ?? true) && complaintKeywords.some(kw => lower.includes(kw))) {
      return { shouldEscalate: true, reason: 'Complaint detected', priority: 'high', leadTag: 'follow_up' };
    }

    if ((rules.highValue ?? true) && highValueKeywords.some(kw => lower.includes(kw))) {
      return { shouldEscalate: true, reason: 'High-value lead detected', priority: 'high', leadTag: 'hot' };
    }

    return { shouldEscalate: false, reason: '', priority: 'normal' };
  }

  getEscalationReply(settings) {
    if (settings.language === 'pidgin') {
      return 'No wahala. I don call our team make person attend to you now.';
    }
    return 'No problem. I will connect you to someone on our team now.';
  }

  localizeReply(reply, settings) {
    if (settings.language !== 'pidgin') return reply;
    return reply
      .replace(/\bYes\b/gi, 'Yes o')
      .replace(/\bDelivery is available\b/gi, 'Delivery dey')
      .replace(/\bWould you like to order\?/gi, 'You wan order?');
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
    if (!this.openai) {
      return settings.language === 'pidgin'
        ? 'I hear you. Can you share small more detail make I help you well?'
        : 'I understand. Can you share a little more detail so I can help you better?';
    }
    
    const relevantFaqs = faqs.slice(0, 3).map(f => `Q: ${f.question}\nA: ${f.answer}`);
    const faqContext = relevantFaqs.join('\n');
    const autoLinks = settings.autoLinks || {};
    const linkContext = [
      autoLinks.storefrontUrl ? `Storefront: ${autoLinks.storefrontUrl}` : '',
      autoLinks.paymentLink ? `Payment link: ${autoLinks.paymentLink}` : '',
      ...(autoLinks.productLinks || []).filter(link => link?.url).map(link => `${link.label || 'Product'}: ${link.url}`),
    ].filter(Boolean).join('\n');

    let systemPrompt = `You are a helpful customer support assistant for a Nigerian business.
Tone: ${settings.tone || 'friendly'}. Language: ${settings.language === 'pidgin' ? 'Nigerian Pidgin' : 'English'}.
Use short, human replies. Help the customer buy, ask one clear next question, and avoid sounding robotic.
Use the following FAQ knowledge to answer the customer. If the question is not covered, answer politely and suggest a human handoff only when needed.
---
${faqContext}
---
Useful links you can share when relevant:
${linkContext || 'No links configured yet.'}
---
Keep responses under 45 words.`;

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
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages: chatMessages,
      max_tokens: 250,
      temperature: 0.7,
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_storefront_summary',
            description: 'Get the user storefront summary including product count, orders, and revenue',
            parameters: { type: 'object', properties: {} },
          },
        },
        {
          type: 'function',
          function: {
            name: 'get_wallet_summary',
            description: 'Get the user wallet balance and recent transactions',
            parameters: { type: 'object', properties: {} },
          },
        },
        {
          type: 'function',
          function: {
            name: 'search_active_campaigns',
            description: 'Search for active campaigns by keyword or category',
            parameters: { type: 'object', properties: { query: { type: 'string' }, category: { type: 'string' } } },
          },
        },
        {
          type: 'function',
          function: {
            name: 'get_marketer_campaigns',
            description: 'Get the user own active campaigns with spend and clicks',
            parameters: { type: 'object', properties: {} },
          },
        },
        {
          type: 'function',
          function: {
            name: 'get_category_benchmarks',
            description: 'Get average CPC and budget benchmarks by campaign category',
            parameters: { type: 'object', properties: { category: { type: 'string' } } },
          },
        },
        {
          type: 'function',
          function: {
            name: 'get_promoter_tier_info',
            description: 'Get the promoter tier, earnings, and click cap usage',
            parameters: { type: 'object', properties: {} },
          },
        },
        {
          type: 'function',
          function: {
            name: 'get_promotion_performance',
            description: 'Get promotion stats for the user promoted products',
            parameters: { type: 'object', properties: {} },
          },
        },
        {
          type: 'function',
          function: {
            name: 'suggest_campaign_budget',
            description: 'Suggest a CPC and daily budget for a given campaign category',
            parameters: { type: 'object', properties: { category: { type: 'string' } } },
          },
        },
      ],
    });

    const choice = completion.choices[0];

    // Handle tool calls
    if (choice.message.tool_calls?.length) {
      const toolResults = [];
      for (const tc of choice.message.tool_calls) {
        const args = JSON.parse(tc.function.arguments || '{}');
        let result = 'Tool not implemented';
        try {
          if (tc.function.name === 'get_storefront_summary') {
            result = JSON.stringify(await this.getStorefrontSummary(userId));
          } else if (tc.function.name === 'get_wallet_summary') {
            result = JSON.stringify(await this.getWalletSummary(userId));
          } else if (tc.function.name === 'search_active_campaigns') {
            result = JSON.stringify(await this.searchActiveCampaigns(args.query, args.category));
          } else if (tc.function.name === 'get_marketer_campaigns') {
            result = JSON.stringify(await this.getMarketerCampaigns(userId));
          } else if (tc.function.name === 'get_category_benchmarks') {
            result = JSON.stringify(await this.getCategoryBenchmarks(args.category));
          } else if (tc.function.name === 'get_promoter_tier_info') {
            result = JSON.stringify(await this.getPromoterTierInfo(userId));
          } else if (tc.function.name === 'get_promotion_performance') {
            result = JSON.stringify(await this.getPromotionPerformance(userId));
          } else if (tc.function.name === 'suggest_campaign_budget') {
            result = JSON.stringify(await this.suggestCampaignBudget(args.category));
          }
        } catch (e) { result = `Error: ${e.message}`; }
        toolResults.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }

      const finalMessages = [...chatMessages, choice.message, ...toolResults];
      const finalCompletion = await this.openai.chat.completions.create({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: finalMessages,
        max_tokens: 250,
        temperature: 0.7,
      });
      return finalCompletion.choices[0].message.content.trim();
    }

    return choice.message.content.trim();
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

    const updateData = {
      lastMessageText: body,
      lastMessageAt: new Date(),
      lastMessageSource: source,
      unreadCount: 0,
    };
    if (source === 'agent') {
      updateData.status = 'active';
      updateData.handledBy = 'human';
    }
    await this.repository.updateConversation(conversationId, config.userId, updateData);

    return message;
  }

  async getStats(userId) {
    if (!userId) throw new Error('userId is required');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalMessages = await this.repository.getTotalMessages(userId);
    const aiHandled = await this.repository.getMessageCountBySource(userId, ['ai', 'faq']);
    const humanHandled = await this.repository.getMessageCountBySource(userId, ['agent']);
    const messagesToday = await this.repository.getMessagesSince(userId, today);
    const aiHandledToday = await this.repository.getMessageCountBySourceSince(userId, ['ai', 'faq'], today);
    const humanHandledToday = await this.repository.getMessageCountBySourceSince(userId, ['agent'], today);
    const avgResponseTime = await this.repository.getAverageResponseTime(userId);
    const escalatedCount = await this.repository.countConversationsByStatus(userId, 'escalated');
    const activeCount = await this.repository.countConversationsByStatus(userId, 'active');
    const totalConversations = await this.repository.countConversations(userId);
    const paidLeads = await this.repository.countConversations(userId, { leadTag: 'paid' });
    const hotLeads = await this.repository.countConversations(userId, { leadTag: 'hot' });
    const totalFaqs = await this.repository.countFaqs(userId);
    const settings = await this.repository.getSettings(userId);
    const daily = await this.repository.getDailyMessageStats(userId, 7);
    const dailyConversations = this.normalizeDailyStats(daily, 7);
    const handledTotal = aiHandled + humanHandled;
    const aiPercent = handledTotal > 0 ? Math.round((aiHandled / handledTotal) * 100) : 0;
    const humanPercent = handledTotal > 0 ? Math.round((humanHandled / handledTotal) * 100) : 0;
    const escalationRate = totalConversations > 0 ? Math.round((escalatedCount / totalConversations) * 100) : 0;
    const conversionRate = totalConversations > 0 ? Math.round((paidLeads / totalConversations) * 100) : 0;
    
    return {
      totalMessages,
      messagesToday,
      aiHandled,
      aiHandledToday,
      humanHandled,
      humanHandledToday,
      aiHandledPercent: aiPercent,
      humanHandledPercent: humanPercent,
      responseTime: Math.round(avgResponseTime * 10) / 10,
      escalatedCount,
      activeCount,
      totalConversations,
      escalationRate,
      conversionRate,
      estimatedConversions: paidLeads + hotLeads,
      totalFaqs,
      aiEnabled: settings.aiEnabled,
      tone: settings.tone,
      language: settings.language,
      connectedWhatsapp: (settings.whatsappNumbers || []).length,
      dailyConversations: dailyConversations.map(day => ({
        ...day,
        count: day.messages,
      })),
      aiVsHumanActivity: [
        { label: 'AI', value: aiHandled },
        { label: 'Human', value: humanHandled },
      ],
      conversionTrends: dailyConversations.map(day => {
        const count = Math.max(0, Math.round(day.messages * (conversionRate / 100)));
        return { date: day.date, count, conversions: count };
      }),
    };
  }

  normalizeDailyStats(rows, days) {
    const map = new Map();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      map.set(key, { date: key, messages: 0, ai: 0, human: 0, customer: 0 });
    }

    rows.forEach(row => {
      const date = row._id.date;
      if (!map.has(date)) return;
      const bucket = map.get(date);
      bucket.messages += row.count;
      if (['ai', 'faq'].includes(row._id.source)) bucket.ai += row.count;
      if (row._id.source === 'agent') bucket.human += row.count;
      if (row._id.source === 'customer') bucket.customer += row.count;
    });

    return Array.from(map.values());
  }

  async getAllConversations(userId, status = null, page = 1, limit = 20, options = {}) {
    if (!userId) throw new Error('userId is required');
    const skip = (page - 1) * limit;
    return this.repository.findConversationsByStatus(userId, status, limit, skip, options);
  }

  async getConversationMessages(userId, conversationId, page = 1, limit = 50) {
    if (!userId) throw new Error('userId is required');
    const conv = await this.repository.findConversationById(conversationId, userId);
    if (!conv) throw new Error('Conversation not found');
    return this.repository.findMessagesByConversation(conversationId, limit);
  }

  async sendManualReply(userId, conversationId, text) {
    if (!userId) throw new Error('userId is required');
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
    if (!userId) throw new Error('userId is required');
    const conv = await this.repository.updateConversation(conversationId, userId, {
      status: 'escalated',
      handledBy: 'human',
      priority: 'high',
      escalationReason: 'Manually escalated',
    });
    await this.repository.createAuditLog({
      userId,
      action: 'escalate_conversation',
      entityType: 'conversation',
      entityId: conversationId,
      performedBy: userId,
    });
    return conv;
  }

  async takeoverConversation(userId, conversationId) {
    if (!userId) throw new Error('userId is required');
    const conv = await this.repository.updateConversation(conversationId, userId, {
      handledBy: 'human',
      status: 'active',
      unreadCount: 0,
      escalationReason: 'Human takeover',
    });
    await this.repository.createAuditLog({
      userId,
      action: 'takeover_conversation',
      entityType: 'conversation',
      entityId: conversationId,
      performedBy: userId,
    });
    return conv;
  }

  async resolveConversation(userId, conversationId) {
    if (!userId) throw new Error('userId is required');
    const conv = await this.repository.updateConversation(conversationId, userId, {
      status: 'resolved',
      unreadCount: 0,
      resolvedAt: new Date(),
    });
    await this.repository.createAuditLog({
      userId,
      action: 'resolve_conversation',
      entityType: 'conversation',
      entityId: conversationId,
      performedBy: userId,
    });
    return conv;
  }

  async tagConversation(userId, conversationId, leadTag) {
    if (!userId) throw new Error('userId is required');
    const allowed = ['new', 'hot', 'interested', 'pending', 'paid', 'follow_up'];
    if (!allowed.includes(leadTag)) throw new Error('Invalid lead tag');
    return this.repository.updateConversation(conversationId, userId, { leadTag });
  }

  async sendQuickAction(userId, conversationId, actionType, payload = {}) {
    const settings = await this.repository.getSettings(userId);
    const autoLinks = settings.autoLinks || {};
    let text = payload.text || '';

    if (actionType === 'storefront') {
      text = autoLinks.storefrontUrl
        ? `You can view our store here: ${autoLinks.storefrontUrl}`
        : 'Please send your preferred product and our team will share the store link.';
    }

    if (actionType === 'payment') {
      text = autoLinks.paymentLink
        ? `You can make payment here: ${autoLinks.paymentLink}`
        : 'I will share the payment link with you shortly.';
    }

    if (actionType === 'product') {
      const productLink = (autoLinks.productLinks || []).find(link => link.label === payload.label) || (autoLinks.productLinks || [])[0];
      text = productLink?.url ? `${productLink.label || 'Product'}: ${productLink.url}` : text;
    }

    if (!text.trim()) throw new Error('No message configured for this action');
    return this.sendManualReply(userId, conversationId, text);
  }

  async assignConversation(userId, conversationId, assigneeId) {
    if (!userId) throw new Error('userId is required');
    return this.repository.assignConversation(conversationId, userId, assigneeId);
  }

  async getFaqs(userId) {
    if (!userId) throw new Error('userId is required');
    return this.repository.findFaqsByUser(userId);
  }

  async addFaq(userId, data) {
    if (!userId) throw new Error('userId is required');
    const faq = await this.repository.createFaq({ userId, ...data });
    cacheService.del(`faqs:${userId}`);
    return faq;
  }

  async updateFaq(userId, faqId, data) {
    if (!userId) throw new Error('userId is required');
    const faq = await this.repository.updateFaq(faqId, userId, data);
    cacheService.del(`faqs:${userId}`);
    return faq;
  }

  async deleteFaq(userId, faqId) {
    if (!userId) throw new Error('userId is required');
    const result = await this.repository.deleteFaq(faqId, userId);
    cacheService.del(`faqs:${userId}`);
    return result;
  }

  async getSettings(userId) {
    if (!userId) throw new Error('userId is required');
    return this.repository.getSettings(userId);
  }

  async updateSettings(userId, data) {
    if (!userId) throw new Error('userId is required');
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
    if (!userId) throw new Error('userId is required');
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
    if (!userId) throw new Error('userId is required');
    return this.repository.findTemplatesByUser(userId);
  }

  async addTemplate(userId, data) {
    if (!userId) throw new Error('userId is required');
    return this.repository.createTemplate({ userId, ...data });
  }

  async updateTemplate(userId, templateId, data) {
    if (!userId) throw new Error('userId is required');
    return this.repository.updateTemplate(templateId, userId, data);
  }

  async resolveTemplate(userId, templateId, variables = {}) {
    if (!userId) throw new Error('userId is required');
    const template = await this.repository.findTemplateById(templateId, userId);
    if (!template) throw new Error('Template not found');
    let text = template.content;
    for (const [key, value] of Object.entries(variables)) {
      text = text.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return { text, template };
  }

  async deleteTemplate(userId, templateId) {
    if (!userId) throw new Error('userId is required');
    return this.repository.deleteTemplate(templateId, userId);
  }

  // ─────────── Tool Handlers ───────────
  async getStorefrontSummary(userId) {
    try {
      const { StoreModel } = await import('../../store/models/store/index.js');
      const [storeCount, stores] = await Promise.all([
        StoreModel.countDocuments({ owner: userId }),
        StoreModel.find({ owner: userId }).select('name analytics type').lean(),
      ]);
      const totalOrders = stores.reduce((s, st) => s + (st.analytics?.totalOrders || 0), 0);
      const totalRevenue = stores.reduce((s, st) => s + (st.analytics?.totalRevenue || 0), 0);
      return { stores: storeCount, totalOrders, totalRevenue, types: stores.map(s => s.type) };
    } catch (e) { return { error: 'Store data unavailable' }; }
  }

  async getWalletSummary(userId) {
    try {
      const { UserModel } = await import('../../user/models/user/index.js');
      const user = await UserModel.findById(userId).select('wallets').lean();
      const m = user?.wallets?.marketer || {};
      return {
        balance: m.balance || 0,
        currency: m.currency || 'NGN',
        reserved: m.reserved || 0,
        totalEarnings: m.totalEarnings || 0,
      };
    } catch (e) { return { error: 'Wallet data unavailable' }; }
  }

  async searchActiveCampaigns(query, category) {
    try {
      const { CampaignModel } = await import('../../campaign/models/campaign.model.js');
      const filter = { status: 'active', isDeleted: false };
      if (query) filter.$or = [{ title: new RegExp(query, 'i') }, { description: new RegExp(query, 'i') }];
      if (category) filter.category = new RegExp(category, 'i');
      const campaigns = await CampaignModel.find(filter).select('title budget cpc category').limit(5).lean();
      return campaigns.map(c => ({ title: c.title, budget: c.budget, cpc: c.cpc, category: c.category }));
    } catch (e) { return { error: 'Campaign data unavailable' }; }
  }

  async getMarketerCampaigns(userId) {
    try {
      const { CampaignModel } = await import('../../campaign/models/campaign.model.js');
      const campaigns = await CampaignModel.find({ owner: userId, isDeleted: false, status: 'active' })
        .select('title budget cpc views clicks category').limit(10).lean();
      return campaigns.map(c => ({ title: c.title, budget: c.budget, cpc: c.cpc, views: c.views || 0, clicks: c.clicks || 0, category: c.category }));
    } catch (e) { return { error: 'Campaign data unavailable' }; }
  }

  async getCategoryBenchmarks(category) {
    try {
      const { CampaignModel } = await import('../../campaign/models/campaign.model.js');
      const agg = await CampaignModel.aggregate([
        { $match: { isDeleted: false, status: 'active', ...(category ? { category: new RegExp(category, 'i') } : {}) } },
        { $group: { _id: '$category', avgCpc: { $avg: '$cpc' }, avgBudget: { $avg: '$budget' }, count: { $sum: 1 } } },
        { $limit: 5 },
      ]);
      return agg.length ? agg : [{ _id: 'general', avgCpc: 50, avgBudget: 50000, count: 0 }];
    } catch (e) { return [{ _id: 'general', avgCpc: 50, avgBudget: 50000, count: 0 }]; }
  }

  async getPromoterTierInfo(userId) {
    try {
      const { UserModel } = await import('../../user/models/user/index.js');
      const user = await UserModel.findById(userId).select('wallets displayName').lean();
      const p = user?.wallets?.promoter || {};
      return { balance: p.balance || 0, totalEarnings: p.totalEarnings || 0, tier: p.tier || 'Bronze', clickCap: p.clickCap || 200 };
    } catch (e) { return { tier: 'Bronze', balance: 0, totalEarnings: 0 }; }
  }

  async getPromotionPerformance(userId) {
    try {
      const m = await import('../../store/models/promotion/index.js');
      const trackings = await m.PromotionTrackingModel.find({ promoter: userId, isActive: true })
        .populate('product', 'name').limit(10).lean();
      return trackings.map(t => ({
        product: t.product?.name || 'Product',
        views: t.viewCount || 0, clicks: t.clickCount || 0,
        conversions: t.conversionCount || 0, earnings: t.earnings || 0,
      }));
    } catch (e) { return []; }
  }

  async suggestCampaignBudget(category) {
    try {
      const { CampaignModel } = await import('../../campaign/models/campaign.model.js');
      const agg = await CampaignModel.aggregate([
        { $match: { isDeleted: false, status: 'active', ...(category ? { category: new RegExp(category, 'i') } : {}) } },
        { $group: { _id: null, avgCpc: { $avg: '$cpc' }, avgBudget: { $avg: '$budget' } } },
      ]);
      const r = agg[0];
      return { suggestedCpc: Math.round((r?.avgCpc || 50) * 0.9), suggestedBudget: Math.round((r?.avgBudget || 50000) * 0.8), currency: 'NGN' };
    } catch (e) { return { suggestedCpc: 50, suggestedBudget: 50000, currency: 'NGN' }; }
  }
}
