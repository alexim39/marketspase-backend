import { marketAiChat } from '../services/copilot.service.js';

const rateLimitMap = new Map();
const RATE_LIMITS = { free: 10, basic: 50, advanced: 200 };

function getRateLimit(role) { return RATE_LIMITS[role] || 10; }

export const handleMarketAiMessage = async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ success: false, message: 'Message required' });

    const key = `${req.userId}:${new Date().toDateString()}`;
    const count = (rateLimitMap.get(key) || 0) + 1;
    const limit = getRateLimit(req.user?.role || 'free');
    if (count > limit) return res.status(429).json({ success: false, message: `Daily limit of ${limit} messages reached.` });
    rateLimitMap.set(key, count);

    if (rateLimitMap.size > 10000) {
      const today = new Date().toDateString();
      for (const [k] of rateLimitMap) { if (!k.endsWith(today)) rateLimitMap.delete(k); }
    }

    const result = await marketAiChat(req.userId, message, history || []);
    return res.json({ success: true, data: { reply: result.reply, toolsUsed: result.toolsUsed } });
  } catch (e) {
    console.error('MarketAI error:', e.message);
    return res.status(500).json({ success: false, message: `MarketAI unavailable: ${e.message || 'Unknown error'}. Check server logs.` });
  }
};
