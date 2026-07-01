import OpenAI from 'openai';

const ai = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' });

const CATEGORIES = [
  'fashion', 'food', 'tech', 'health', 'travel', 'education', 'entertainment', 'business',
  'lifestyle', 'automotive', 'sports', 'realestate', 'events', 'gaming', 'nonprofit',
  'politics', 'religion', 'parenting', 'pets', 'art', 'home', 'science', 'jobs',
  'finance', 'insurance', 'legal', 'music', 'movies', 'telecom', 'utilities', 'crypto',
  'environment', 'agriculture', 'shopping', 'beauty', 'fashionmen', 'fashionwomen',
  'kids', 'books', 'luxury', 'arts', 'software', 'hardware', 'productivity', 'dating',
  'transport', 'startups', 'influencers', 'reviews', 'other',
];

export const suggestCampaign = async (req, res) => {
  try {
    const { description, goal, budgetTier } = req.body;
    if (!description?.trim()) return res.status(400).json({ success: false, message: 'Product description is required.' });

    const budgetRanges = {
      low: { min: 1000, max: 5000, label: '₦1,000 - ₦5,000' },
      medium: { min: 5000, max: 20000, label: '₦5,000 - ₦20,000' },
      high: { min: 20000, max: 100000, label: '₦20,000 - ₦100,000' },
    };
    const range = budgetRanges[budgetTier] || budgetRanges.medium;

    const goalMap = {
      sales: { campaignGoal: 'awareness', payoutModel: 'pay_per_click' },
      leads: { campaignGoal: 'leads', payoutModel: 'cost_per_lead' },
      awareness: { campaignGoal: 'awareness', payoutModel: 'pay_per_click' },
    };
    const goalConfig = goalMap[goal] || goalMap.sales;

    const prompt = `You are a campaign builder for MarketSpase, a Nigerian marketplace platform.
Generate a campaign for this product/service: """${description.trim()}"""
Goal: ${goal} | Budget range: ${range.label} | Payout model: ${goalConfig.payoutModel}

Return ONLY a valid JSON object (no markdown, no commentary) with exactly these fields:
{
  "title": "engaging ad title in Nigerian English (max 80 chars, catchy but professional)",
  "caption": "compelling ad copy in Nigerian English (200-400 chars, include a call to action, mention the budget range value proposition)",
  "category": "one category value from this list: ${CATEGORIES.join(', ')}",
  "suggestedBudget": number (NGN, within ${range.min}-${range.max}),
  "ageTarget": "all" or "young" or "middle" or "advanced",
  "link": "an optional URL if the product likely has a website/store page, or empty string"
}`;

    const completion = await ai.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.8,
    });

    const raw = completion.choices[0].message.content.trim();
    const json = JSON.parse(raw.replace(/```json|```/g, '').trim());

    if (!CATEGORIES.includes(json.category)) json.category = 'other';
    if (!['all', 'young', 'middle', 'advanced'].includes(json.ageTarget)) json.ageTarget = 'all';
    if (typeof json.suggestedBudget !== 'number' || json.suggestedBudget < 1000) json.suggestedBudget = 5000;

    res.json({ success: true, data: { ...json, payoutModel: goalConfig.payoutModel, campaignGoal: goalConfig.campaignGoal } });
  } catch (e) {
    console.error('Campaign suggestion error:', e.message);
    res.status(500).json({ success: false, message: 'Failed to generate campaign. Please try again or use manual setup.' });
  }
};
