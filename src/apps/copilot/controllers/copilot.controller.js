import { copilotChat } from '../services/copilot.service.js';

// Simple in-memory rate limiter
const rateLimitMap = new Map();
const RATE_LIMITS = { free: 10, basic: 50, advanced: 200 };

function getRateLimit(role) { return RATE_LIMITS[role] || 10; }

export const handleCopilotMessage = async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ success: false, message: 'Message required' });

    // Rate limiting
    const key = `${req.userId}:${new Date().toDateString()}`;
    const count = (rateLimitMap.get(key) || 0) + 1;
    const limit = getRateLimit(req.user?.role || 'free');
    if (count > limit) return res.status(429).json({ success: false, message: `Daily limit of ${limit} messages reached.` });
    rateLimitMap.set(key, count);

    // Clean old entries every hour
    if (rateLimitMap.size > 10000) {
      const today = new Date().toDateString();
      for (const [k] of rateLimitMap) { if (!k.endsWith(today)) rateLimitMap.delete(k); }
    }

    const result = await copilotChat(req.userId, message, history || []);
    return res.json({ success: true, data: { reply: result.reply, toolsUsed: result.toolsUsed } });
  } catch (e) {
    console.error('Copilot error:', e.message, e.stack?.split('\n')[0]);
    return res.status(500).json({ success: false, message: `AI unavailable: ${e.message || 'Unknown error'}. Check server logs.` });
  }
};
