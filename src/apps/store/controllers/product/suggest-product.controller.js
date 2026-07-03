import OpenAI from 'openai';

const ai = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' })
  : null;

const CATEGORIES = 'fashion,food,tech,health,travel,education,entertainment,business,lifestyle,automotive,sports,realestate,events,gaming,nonprofit,politics,religion,parenting,pets,art,home,science,jobs,finance,insurance,legal,music,movies,telecom,utilities,crypto,environment,agriculture,shopping,beauty,fashionmen,fashionwomen,kids,books,luxury,arts,software,hardware,productivity,dating,transport,startups,influencers,reviews,other';

export const suggestProduct = async (req, res) => {
  try {
    if (!ai) return res.status(503).json({ success: false, message: 'AI service not configured.' });
    const { description } = req.body;
    if (!description?.trim()) return res.status(400).json({ success: false, message: 'Product description required.' });

    const prompt = `You are an e-commerce product specialist for MarketSpase, a Nigerian marketplace.
Given this product description, generate optimized product data:
"""${description.trim()}"""

Return ONLY valid JSON (no markdown, no commentary):
{
  "name": "product name (max 150 chars, SEO-friendly, include key features)",
  "description": "compelling product description (200-800 chars, highlight benefits, Nigerian English)",
  "category": "one of: ${CATEGORIES}",
  "tags": ["3-5 relevant tags from these options: New,Popular,Sale,Limited,Exclusive,Trending,Discount,Premium,Organic,Handmade,Local,Imported,BestSeller,Clearance,Seasonal,Custom,Gift,Essential or custom ones fitting the product"],
  "brand": "brand name if mentioned, or empty string",
  "suggestedPrice": number (NGN, realistic market price),
  "commissionRate": number (5-20, suggested affiliate commission percentage),
  "hasVariants": true if description mentions multiple colors/sizes/styles, otherwise false,
  "isDigital": true if it's a digital/virtual product, otherwise false,
  "seoTitle": "SEO title (max 60 chars)",
  "seoDescription": "SEO meta description (max 160 chars)"
}`;

    const completion = await ai.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.8,
    });

    const raw = completion.choices[0].message.content.trim();
    let data;
    try {
      data = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch (parseError) {
      console.error('Product suggest JSON parse error:', parseError.message, 'Raw:', raw.substring(0, 200));
      return res.status(500).json({ success: false, message: 'AI returned invalid response. Try describing your product differently.' });
    }

    if (!CATEGORIES.split(',').includes(data.category)) data.category = 'other';
    if (!Array.isArray(data.tags)) data.tags = [];
    data.tags = data.tags.slice(0, 5).map(t => String(t));
    if (typeof data.suggestedPrice !== 'number' || data.suggestedPrice < 100) data.suggestedPrice = 100;
    if (typeof data.commissionRate !== 'number' || data.commissionRate < 0) data.commissionRate = 10;
    data.commissionRate = Math.min(100, Math.max(0, Math.round(data.commissionRate)));

    res.json({ success: true, data });
  } catch (e) {
    console.error('Product suggest error:', e.message);
    res.status(500).json({ success: false, message: 'Failed to generate. Try again or fill manually.' });
  }
};
