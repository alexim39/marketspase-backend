import OpenAI from 'openai';

const ai = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' })
  : null;

const CATEGORIES = 'fashion,food,tech,health,travel,education,entertainment,business,lifestyle,automotive,sports,realestate,events,gaming,nonprofit,politics,religion,parenting,pets,art,home,science,jobs,finance,insurance,legal,music,movies,telecom,utilities,crypto,environment,agriculture,shopping,beauty,fashionmen,fashionwomen,kids,books,luxury,arts,software,hardware,productivity,dating,transport,startups,influencers,reviews,other';

export const suggestService = async (req, res) => {
  try {
    if (!ai) return res.status(503).json({ success: false, message: 'AI service not configured.' });
    const { name, category, description } = req.body;
    const input = (name || description || '').trim();
    if (!input) return res.status(400).json({ success: false, message: 'Service name or description required.' });

    const prompt = `You are a service business specialist for MarketSpase, a Nigerian marketplace.
Given this service information, generate optimized service data:
Name: "${name || ''}"
Description context: "${description || ''}"
Category: ${category || 'any'}

Return ONLY valid JSON:
{
  "description": "compelling service description (200-600 chars, highlight expertise and value)",
  "category": "one of: ${CATEGORIES} (if category not specified above)",
  "includes": ["3-6 specific deliverables or features included in this service"],
  "pricingType": "fixed" or "hourly" or "package" or "quote" (best fit for this service type),
  "suggestedPrice": number (NGN, realistic price reflecting Nigerian market rates),
  "deliveryTime": "estimated delivery time e.g. '2-3 days' or '1 week'",
  "availability": "available"
}`;

    const completion = await ai.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.8,
    });

    const raw = completion.choices[0].message.content.trim();
    let data;
    try {
      data = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch (parseError) {
      console.error('Service suggest JSON parse error:', parseError.message, 'Raw:', raw.substring(0, 200));
      return res.status(500).json({ success: false, message: 'AI returned invalid response. Try again or describe your service differently.' });
    }

    if (!data || typeof data !== 'object') {
      return res.status(500).json({ success: false, message: 'AI returned empty response. Try again.' });
    }

    if (!CATEGORIES.split(',').includes(data.category)) data.category = category || 'other';
    if (!Array.isArray(data.includes)) data.includes = [];
    if (!['fixed', 'hourly', 'package', 'quote'].includes(data.pricingType)) data.pricingType = 'fixed';
    if (typeof data.suggestedPrice !== 'number' || data.suggestedPrice < 0) data.suggestedPrice = 0;

    res.json({ success: true, data });
  } catch (e) {
    console.error('Service suggest error:', e.message);
    res.status(500).json({ success: false, message: 'Failed to generate. Try again or fill manually.' });
  }
};
