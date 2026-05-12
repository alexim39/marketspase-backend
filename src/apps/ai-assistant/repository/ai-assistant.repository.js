import { Faq, Conversation, Message, AiSettings, WhatsAppConfig, MessageTemplate, AuditLog } from '../model/index.js';

export class AiAssistantRepository {
  // ==================== FAQ ====================
  async findFaqsByUser(userId) {
    return Faq.find({ userId }).sort({ createdAt: -1 });
  }

  async createFaq(data) {
    // FIXED: Was destructuring undefined variables. Now passes the full data object
    return Faq.create(data);
  }

  async updateFaq(faqId, userId, updates) {
    return Faq.findOneAndUpdate({ _id: faqId, userId }, updates, { new: true });
  }

  async deleteFaq(faqId, userId) {
    return Faq.findOneAndDelete({ _id: faqId, userId });
  }

  async findFaqById(faqId, userId) {
    return Faq.findOne({ _id: faqId, userId });
  }

  // ==================== CONVERSATION ====================
  async findOrCreateConversation(userId, customerWaId, customerName) {
    let conv = await Conversation.findOne({ userId, customerWaId, status: { $ne: 'resolved' } });
    if (!conv) {
      conv = await Conversation.create({
        userId,
        customerWaId,
        customerName: customerName || 'Customer',
      });
    }
    return conv;
  }

  async updateConversation(convId, userId, updates) {
    return Conversation.findOneAndUpdate({ _id: convId, userId }, updates, { new: true });
  }

  async findConversationsByUser(userId, status = null) {
    const filter = { userId };
    if (status) filter.status = status;
    return Conversation.find(filter).sort({ lastMessageAt: -1 });
  }

  // FIXED: Added missing method required by service layer
  async findConversationsByStatus(userId, status, limit = 50, skip = 0, options = {}) {
    const filter = { userId };
    if (status) filter.status = status;
    if (options.leadTag) filter.leadTag = options.leadTag;
    if (options.search) {
      const search = new RegExp(options.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { customerName: search },
        { customerWaId: search },
        { lastMessageText: search },
      ];
    }
    return Conversation.find(filter)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  // FIXED: Added missing method
  async countConversationsByStatus(userId, status) {
    return Conversation.countDocuments({ userId, status });
  }

  async countConversations(userId, extraFilter = {}) {
    return Conversation.countDocuments({ userId, ...extraFilter });
  }

  async findConversationById(convId, userId) {
    return Conversation.findOne({ _id: convId, userId });
  }

  // FIXED: Added missing method
  async assignConversation(convId, userId, assigneeId) {
    return Conversation.findOneAndUpdate(
      { _id: convId, userId },
      { assignedTo: assigneeId, status: 'escalated', handledBy: 'human' },
      { new: true }
    );
  }

  // ==================== MESSAGES ====================
  async createMessage(conversationId, data) {
    return Message.create({ conversationId, ...data });
  }

  async findMessagesByConversation(conversationId, limit = 50) {
    const messages = await Message.find({ conversationId }).sort({ timestamp: -1 }).limit(limit);
    return messages.reverse();
  }

  async countMessagesByConversation(conversationId, sourceList = null) {
    const filter = { conversationId };
    if (sourceList) filter.source = { $in: sourceList };
    return Message.countDocuments(filter);
  }

  // ==================== STATS ====================
  // FIXED: Was calling _conversationIdsForUser (private naming). Now uses public method
  async getTotalMessages(userId) {
    const convIds = await this.getConversationIdsForUser(userId);
    if (!convIds.length) return 0;
    return Message.countDocuments({ conversationId: { $in: convIds } });
  }

  async getMessagesSince(userId, since) {
    const convIds = await this.getConversationIdsForUser(userId);
    if (!convIds.length) return 0;
    return Message.countDocuments({
      conversationId: { $in: convIds },
      timestamp: { $gte: since },
    });
  }

  async getMessageCountBySource(userId, sourceList) {
    const convIds = await this.getConversationIdsForUser(userId);
    if (!convIds.length) return 0;
    return Message.countDocuments({
      conversationId: { $in: convIds },
      source: { $in: sourceList },
    });
  }

  async getMessageCountBySourceSince(userId, sourceList, since) {
    const convIds = await this.getConversationIdsForUser(userId);
    if (!convIds.length) return 0;
    return Message.countDocuments({
      conversationId: { $in: convIds },
      source: { $in: sourceList },
      timestamp: { $gte: since },
    });
  }

  async getDailyMessageStats(userId, days = 7) {
    const convIds = await this.getConversationIdsForUser(userId);
    if (!convIds.length) return [];

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    return Message.aggregate([
      {
        $match: {
          conversationId: { $in: convIds },
          timestamp: { $gte: start },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            source: '$source',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);
  }

  async getConversationIdsForUser(userId) {
    const convs = await Conversation.find({ userId }, '_id');
    return convs.map(c => c._id);
  }

  async getAverageResponseTime(userId) {
    const convs = await Conversation.find({ userId });
    const convIds = convs.map(c => c._id);
    const messages = await Message.find({
      conversationId: { $in: convIds },
    }).sort({ timestamp: 1 });

    let totalDiff = 0;
    let count = 0;
    for (const conversationId of convIds) {
      const msgs = messages.filter(m => m.conversationId.toString() === conversationId.toString());
      for (let i = 0; i < msgs.length - 1; i++) {
        if (msgs[i].direction === 'inbound' && msgs[i + 1].direction === 'outbound') {
          totalDiff += msgs[i + 1].timestamp - msgs[i].timestamp;
          count++;
        }
      }
    }
    return count ? totalDiff / count / 1000 : 0;
  }

  // ==================== AI SETTINGS ====================
  async getSettings(userId) {
    let settings = await AiSettings.findOne({ userId });
    if (!settings) {
      settings = await AiSettings.create({ userId });
    }
    return settings;
  }

  async countFaqs(userId) {
    return Faq.countDocuments({ userId });
  }

  async updateSettings(userId, updates) {
    return AiSettings.findOneAndUpdate({ userId }, updates, { new: true, upsert: true });
  }

  // ==================== WHATSAPP CONFIG ====================
  async getWhatsAppConfig(userId) {
    return WhatsAppConfig.findOne({ userId, isActive: true });
  }

  async getWhatsAppConfigByPhone(phoneNumber) {
    return WhatsAppConfig.findOne({ phoneNumber, isActive: true });
  }

  async createOrUpdateWhatsAppConfig(userId, data) {
    return WhatsAppConfig.findOneAndUpdate({ userId }, data, { upsert: true, new: true });
  }

  // ==================== MESSAGE TEMPLATES (ADDED) ====================
  async findTemplatesByUser(userId) {
    return MessageTemplate.find({ userId, isActive: true }).sort({ createdAt: -1 });
  }

  async createTemplate(data) {
    return MessageTemplate.create(data);
  }

  async updateTemplate(templateId, userId, updates) {
    return MessageTemplate.findOneAndUpdate({ _id: templateId, userId }, updates, { new: true });
  }

  async deleteTemplate(templateId, userId) {
    return MessageTemplate.findOneAndDelete({ _id: templateId, userId });
  }

  // ==================== AUDIT LOG (ADDED) ====================
  async createAuditLog(data) {
    return AuditLog.create(data);
  }
}
