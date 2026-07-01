import OpenAI from 'openai';
import mongoose from 'mongoose';

let openai = null;
function getOpenAI() {
  if (!openai && process.env.DEEPSEEK_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' });
  }
  return openai;
}

const MODEL = process.env.MARKETAI_MODEL || 'deepseek-chat';

// === TOOLS (8 functions the AI can call) ===

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_active_campaigns',
      description: 'Search active campaigns for a promoter. Returns campaigns sorted by match score (category affinity + CPC).',
      parameters: { type: 'object', properties: { category: { type: 'string', description: 'Filter by campaign category' }, limit: { type: 'number', default: 5 } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_marketer_campaigns',
      description: 'Get all campaigns owned by a marketer with performance stats.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_category_benchmarks',
      description: 'Get average budget, spend, clicks, and conversion rate for a campaign category. Helps suggest budgets.',
      parameters: { type: 'object', properties: { category: { type: 'string' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_wallet_summary',
      description: 'Get wallet balance summary for a user.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_promoter_tier_info',
      description: 'Get promoter tier (gold/silver/bronze/unranked) and how to reach the next tier.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_storefront_summary',
      description: 'Get storefront performance summary: orders, revenue, top products.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_promotion_performance',
      description: "Get a promoter's promotion performance: accepted campaigns, clicks, conversions, earnings.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_campaign_budget',
      description: "Suggest an optimal campaign budget based on category benchmarks and user's wallet balance.",
      parameters: { type: 'object', properties: { category: { type: 'string' }, walletBalance: { type: 'number' } } },
    },
  },
];

// === SYSTEM PROMPT BUILDER ===

async function buildSystemPrompt(userId) {
  const UserModel = (await import('../../user/models/user/index.js')).UserModel;
  const CampaignModel = (await import('../../campaign/models/campaign.model.js')).CampaignModel;
  const PromotionTrackingModel = (await import('../../store/models/promotion/index.js')).PromotionTrackingModel;

  const user = await UserModel.findById(userId).select('displayName role promoterTier wallets personalInfo').lean();
  const activeCampaigns = await CampaignModel.countDocuments({ owner: userId, status: 'active', isDeleted: false });
  const activePromotions = await PromotionTrackingModel.countDocuments({ promoter: userId, isActive: true });

  const wallet = user?.wallets?.marketer || user?.wallets?.promoter || {};
  const balance = wallet.balance || 0;
  const reserved = wallet.reserved || 0;
  const tier = user?.promoterTier || 'unranked';
  const locale = user?.preferredLocale || 'en';
  const langInstruction = locale === 'fr'
    ? 'Respond in French.'
    : locale === 'ha' ? 'Respond in Hausa.'
    : locale === 'yo' ? 'Respond in Yoruba.'
    : 'Respond in English.';

  return `You are MarketAI — MarketSpase's intelligent assistant for ${user?.role === 'marketer' ? 'marketers' : 'promoters'}. MarketSpase connects marketers (who create ad campaigns) with promoters (who share campaigns to earn per click).

## Current User Context
- Name: ${user?.displayName || 'User'}
- Role: ${user?.role || 'user'}
- Promoter Tier: ${tier === 'unranked' ? 'Unranked (new — earn your first clicks to rank up)' : `${tier.charAt(0).toUpperCase() + tier.slice(1)}`}
- Wallet Balance: ₦${balance.toLocaleString()} (Available) + ₦${reserved.toLocaleString()} (Reserved)
${user?.role === 'marketer' ? `- Active Campaigns: ${activeCampaigns}` : ''}
${user?.role === 'promoter' ? `- Active Promotions: ${activePromotions}` : ''}

## How Rates Work
- Marketers set a base Cost-Per-Click (CPC). Promoters earn the CPC per click.
- Gold promoters earn CPC + 20% bonus, Silver +10%, Bronze +5%, Unranked: base CPC.
- Average CPC on the platform is ₦80.
- Promoter earnings are held in escrow for 10 hours before becoming available.

## Your Role
${langInstruction}
Answer questions naturally. Use the tools available to get real data when needed. Give specific, actionable advice. Be encouraging but direct. Keep responses under 3 sentences unless the user asks for detail.

## Platform Tips
- New marketers should start with ₦10,000-50,000 budget to test campaigns.
- Promoters should promote 3-5 campaigns to diversify earnings.
- Campaigns with billable clicks > 100 and conversion rate > 2% are performing well.`;
}

// === FUNCTION DISPATCHER ===

async function executeToolCall(functionName, args, userId) {
  const ObjectId = mongoose.Types.ObjectId;
  const UserModel = (await import('../../user/models/user/index.js')).UserModel;
  const CampaignModel = (await import('../../campaign/models/campaign.model.js')).CampaignModel;
  const OrderModel = (await import('../../store/models/order/order.model.js')).OrderModel;
  const PromotionTrackingModel = (await import('../../store/models/promotion/index.js')).PromotionTrackingModel;

  switch (functionName) {
    case 'search_active_campaigns': {
      const campaigns = await CampaignModel.find({
        status: 'active', isDeleted: false,
        ...(args.category ? { category: new RegExp(args.category, 'i') } : {}),
      }).select('title category budget spentBudget costPerClick billableClicks status').sort({ billableClicks: -1 }).limit(args.limit || 5).lean();
      return campaigns.map(c => `${c.title} (${c.category}) — ₦${c.costPerClick}/click, ${c.billableClicks} clicks, ${c.status}`).join('; ') || 'No active campaigns found.';
    }

    case 'get_marketer_campaigns': {
      const campaigns = await CampaignModel.find({ owner: new ObjectId(userId), isDeleted: false }).select('title budget spentBudget billableClicks status costPerClick').sort({ createdAt: -1 }).limit(10).lean();
      return campaigns.map(c => `${c.title} — ₦${c.budget.toLocaleString()} budget, ₦${(c.spentBudget||0).toLocaleString()} spent, ${c.billableClicks||0} clicks, ${c.status}`).join('; ') || 'No campaigns yet. Create one from the dashboard!';
    }

    case 'get_category_benchmarks': {
      const match = { isDeleted: false, status: { $in: ['active', 'completed', 'exhausted'] } };
      if (args.category) match.category = new RegExp(args.category, 'i');
      const stats = await CampaignModel.aggregate([
        { $match: match },
        { $group: { _id: null, avgBudget: { $avg: '$budget' }, avgSpent: { $avg: '$spentBudget' }, avgClicks: { $avg: '$billableClicks' }, count: { $sum: 1 }, avgCPC: { $avg: '$costPerClick' } } },
      ]).then(r => r[0] || {});
      return `${stats.count || 0} campaigns in category. Avg budget: ₦${Math.round(stats.avgBudget||0).toLocaleString()}. Avg spend: ₦${Math.round(stats.avgSpent||0).toLocaleString()}. Avg CPC: ₦${Math.round(stats.avgCPC||80)}. Avg clicks: ${Math.round(stats.avgClicks||0)}.`;
    }

    case 'get_wallet_summary': {
      const user = await UserModel.findById(userId).select('wallets').lean();
      const m = user?.wallets?.marketer || {};
      const p = user?.wallets?.promoter || {};
      return `Marketer: ₦${(m.balance||0).toLocaleString()} available, ₦${(m.reserved||0).toLocaleString()} reserved. Promoter: ₦${(p.balance||0).toLocaleString()} available, ₦${(p.reserved||0).toLocaleString()} reserved (10hr escrow hold).`;
    }

    case 'get_promoter_tier_info': {
      const user = await UserModel.findById(userId).select('promoterTier').lean();
      const tier = user?.promoterTier || 'unranked';
      const nextTier = { unranked: 'Bronze (10+ clicks, 0.5%+ conv rate, ₦1,000+ earned)', bronze: 'Silver (100+ clicks, 1.5%+ conv rate, ₦10,000+ earned)', silver: 'Gold (500+ clicks, 3%+ conv rate, ₦50,000+ earned)', gold: 'Max tier reached!' };
      return `Current tier: ${tier}. Next tier: ${nextTier[tier] || 'Keep performing to maintain Gold!'}`;
    }

    case 'get_storefront_summary': {
      const stats = await OrderModel.aggregate([
        { $match: { marketer: new ObjectId(userId), paymentStatus: 'paid' } },
        { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$totalAmount' }, avgOrder: { $avg: '$totalAmount' } } },
      ]).then(r => r[0] || {});
      return `${stats.orders||0} orders, ₦${Math.round(stats.revenue||0).toLocaleString()} total revenue, ₦${Math.round(stats.avgOrder||0).toLocaleString()} avg order.`;
    }

    case 'get_promotion_performance': {
      const promotions = await PromotionTrackingModel.find({ promoter: new ObjectId(userId), isActive: true }).populate('product', 'name').lean();
      const total = { clicks: 0, conversions: 0, earnings: 0 };
      promotions.forEach(p => { total.clicks += p.clickCount||0; total.conversions += p.conversionCount||0; total.earnings += p.earnings||0; });
      return `${promotions.length} active promotions. ${total.clicks} total clicks, ${total.conversions} conversions, ₦${total.earnings.toLocaleString()} earned.`;
    }

    case 'suggest_campaign_budget': {
      const benchmarks = await executeToolCall('get_category_benchmarks', args, userId);
      return `${benchmarks} Based on this and your wallet balance of ₦${(args.walletBalance||0).toLocaleString()}, I suggest ₦${Math.round(Math.min(args.walletBalance * 0.4, 50000)).toLocaleString()} as a starting budget.`;
    }

    default: return 'Tool not available.';
  }
}

// === MAIN CHAT FUNCTION ===

export async function marketAiChat(userId, userMessage, conversationHistory = []) {
  const client = getOpenAI();
  if (!client) return { reply: 'AI is not configured. Set DEEPSEEK_API_KEY in your .env file to enable MarketAI.', toolsUsed: [] };

  const systemPrompt = await buildSystemPrompt(userId);
  const messages = [{ role: 'system', content: systemPrompt }];
  
  // Add last 10 messages for context
  for (const m of conversationHistory.slice(-10)) {
    messages.push(m);
  }
  messages.push({ role: 'user', content: userMessage });

  const toolsUsed = [];

  // First call: may return function calls
  let response = await client.chat.completions.create({
    model: MODEL, messages, tools: TOOLS, tool_choice: 'auto', temperature: 0.7, max_tokens: 500,
  });

  const choice = response.choices[0];

  // If AI wants to call a tool, execute it and make a second call
  if (choice.message.tool_calls) {
    messages.push(choice.message);
    
    for (const toolCall of choice.message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments || '{}');
      const result = await executeToolCall(toolCall.function.name, args, userId);
      toolsUsed.push(toolCall.function.name);
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: String(result) });
    }

    // Second call with tool results
    response = await client.chat.completions.create({
      model: MODEL, messages, temperature: 0.7, max_tokens: 500,
    });
  }

  return {
    reply: response.choices[0].message.content || "I'm not sure how to help with that. Try asking about campaigns, wallet, or promotions.",
    toolsUsed,
  };
}
