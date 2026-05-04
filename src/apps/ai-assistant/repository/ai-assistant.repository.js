import { Faq, Conversation, Message, AiSettings, WhatsAppConfig } from '../model/index.js';

export class AiAssistantRepository {
  // FAQ
  async findFaqsByUser(userId) {
    return Faq.find({ userId }).sort({ createdAt: -1 });
  }

  async createFaq(data) {
    return Faq.create({ userId, question, answer });
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

  // Conversation
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

  async findConversationById(convId, userId) {
    return Conversation.findOne({ _id: convId, userId });
  }

  // Messages
  async createMessage(conversationId, data) {
    return Message.create({ conversationId, ...data });
  }

  async findMessagesByConversation(conversationId, limit = 50) {
    return Message.find({ conversationId }).sort({ timestamp: 1 }).limit(limit);
  }

  // Stats helpers
  async getMessageCountBySource(userId, sourceList) {
    return Message.countDocuments({
      conversationId: { $in: await this._conversationIdsForUser(userId) },
      source: { $in: sourceList },
    });
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
    return count ? totalDiff / count / 1000 : 0; // seconds
  }

  // AI Settings
  async getSettings(userId) {
    let settings = await AiSettings.findOne({ userId });
    if (!settings) {
      settings = await AiSettings.create({ userId });
    }
    return settings;
  }

  async updateSettings(userId, updates) {
    return AiSettings.findOneAndUpdate({ userId }, updates, { new: true, upsert: true });
  }

  // WhatsApp Config
  async getWhatsAppConfig(userId) {
    return WhatsAppConfig.findOne({ userId });
  }

  async getWhatsAppConfigByPhone(phoneNumber) {
    return WhatsAppConfig.findOne({ phoneNumber });
  }

  async createOrUpdateWhatsAppConfig(userId, data) {
    return WhatsAppConfig.findOneAndUpdate({ userId }, data, { upsert: true, new: true });
  }
}