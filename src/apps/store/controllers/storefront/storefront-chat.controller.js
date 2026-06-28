// Storefront chat controller — public customer-facing chat widget
import { AiAssistantService } from '../../../ai-assistant/service/ai-assistant.service.js';
import { StoreModel } from '../../models/store/index.js';
import { UserModel } from '../../../user/models/user/index.js';

const service = new AiAssistantService();

// Simple rate limiter: 10 messages per session per minute
const rateLimitMap = new Map();

function checkRateLimit(sessionId) {
  const key = `chat:${sessionId}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key) || { count: 0, resetAt: now + 60000 };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 60000; }
  entry.count++;
  rateLimitMap.set(key, entry);
  return entry.count <= 10;
}

export const handleStorefrontChat = async (req, res) => {
  try {
    const { storeLink, message, sessionId } = req.body;
    if (!storeLink || !message?.trim()) {
      return res.status(400).json({ success: false, message: 'storeLink and message required' });
    }

    const store = await StoreModel.findOne({ storeLink, isActive: true, isDeleted: false }).select('owner name').lean();
    if (!store) return res.status(404).json({ success: false, message: 'Store not found' });

    const owner = await UserModel.findById(store.owner).select('_id').lean();
    if (!owner) return res.status(404).json({ success: false, message: 'Store owner not found' });

    const sid = sessionId || `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (!checkRateLimit(sid)) {
      return res.status(429).json({ success: false, message: 'Too many messages. Please wait.' });
    }

    // Use the AI pipeline — mimics handleIncomingMessage but for storefront
    const settings = await service.checkSubscriptionAndPlan(owner._id).catch(() => null);
    
    if (!settings?.aiEnabled) {
      return res.json({
        success: true,
        data: { reply: settings?.language === 'pidgin' ? 'I no dey available for chat right now. Make you try again later.' : 'I\'m not available for chat right now. Please try again later.', sessionId: sid },
      });
    }

    const conversation = await service.repository.findOrCreateConversation(
      owner._id, sid, `Storefront Guest • ${store.name}`,
    );

    await service.repository.createMessage(conversation._id, {
      direction: 'inbound', content: message.trim(), source: 'customer',
      metadata: { source: 'storefront', storeLink, sessionId: sid },
    });

    await service.repository.updateConversation(conversation._id, owner._id, {
      lastMessageText: message, lastMessageAt: new Date(), lastMessageSource: 'customer',
      unreadCount: (conversation.unreadCount || 0) + 1,
    });

    // Check business hours (same logic as WhatsApp)
    const bizHours = settings.responseSettings?.businessHours;
    if (bizHours?.enabled && bizHours.start && bizHours.end) {
      const now = new Date();
      const tz = bizHours.timezone || 'Africa/Lagos';
      const timeStr = now.toLocaleString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
      const [h, m] = timeStr.split(':').map(Number);
      const [sh, sm] = bizHours.start.split(':').map(Number);
      const [eh, em] = bizHours.end.split(':').map(Number);
      const nowMins = h * 60 + m;
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;
      const inHours = startMins <= endMins ? (nowMins >= startMins && nowMins < endMins) : (nowMins >= startMins || nowMins < endMins);
      if (!inHours) {
        const reply = settings.language === 'pidgin'
          ? 'We don dey close work now. We go respond to your message once we open back. Thank you!'
          : 'We\'re currently outside business hours. We\'ll respond to your message as soon as we\'re back. Thank you!';
        return res.json({ success: true, data: { reply, sessionId: sid } });
      }
    }

    // Check escalation keywords
    const escalation = service.detectEscalation ? service.detectEscalation(message, settings) : null;
    if (escalation?.shouldEscalate) {
      await service.repository.updateConversation(conversation._id, owner._id, {
        status: 'escalated', handledBy: 'human', escalationReason: escalation.reason,
      });
      const reply = settings.language === 'pidgin'
        ? 'I don pass your message to our team. Dem go respond to you soon.'
        : 'I\'ve forwarded your message to our team. They\'ll respond shortly.';
      return res.json({ success: true, data: { reply, sessionId: sid } });
    }

    // FAQ match → AI response
    const faqs = await service.getCachedFaqs(owner._id);
    const matchedFaq = service.findBestFaqMatch ? service.findBestFaqMatch(message, faqs) : null;

    let reply;
    if (matchedFaq) {
      reply = matchedFaq.answer;
      await service.repository.createMessage(conversation._id, {
        direction: 'outbound', content: reply, source: 'faq',
        metadata: { matchedFaqId: matchedFaq._id },
      });
    } else {
      reply = await service.getAIResponse(owner._id, conversation._id, message, faqs, settings);
      await service.repository.createMessage(conversation._id, {
        direction: 'outbound', content: reply, source: 'ai',
        metadata: { confidence: null },
      });
    }

    await service.repository.updateConversation(conversation._id, owner._id, {
      lastMessageText: reply, lastMessageAt: new Date(), lastMessageSource: 'ai',
    });

    return res.json({ success: true, data: { reply, sessionId: sid } });
  } catch (e) {
    console.error('Storefront chat error:', e.message);
    return res.status(500).json({ success: false, message: 'Chat unavailable. Try again shortly.' });
  }
};
