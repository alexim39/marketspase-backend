import OpenAI from 'openai';

const ai = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' })
  : null;

export const optimizeCampaignContent = async (req, res) => {
  try {
    if (!ai) return res.status(503).json({ success: false, message: 'AI service is not configured.' });
    const campaignId = req.params.id;
    const { CampaignModel } = await import('../models/campaign.model.js');
    const campaign = await CampaignModel.findOne({ _id: campaignId, owner: req.userId })
      .select('title caption category mediaUrl').lean();
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found.' });

    const prompt = `You are a conversion optimization expert for Nigerian digital ads.
Analyze this campaign and suggest 3 A/B test variations:

Title: "${campaign.title}"
Caption: "${campaign.caption}"
Category: ${campaign.category}
Has Media: ${campaign.mediaUrl ? 'Yes' : 'No'}

Return ONLY a JSON array with exactly 3 objects (no markdown, no commentary):
[{
  "variantTitle": "alternative title (max 80 chars, Nigerian English)",
  "variantCaption": "alternative caption (200-400 chars, include CTA)",
  "rationale": "why this variant might perform better (1 sentence)"
}]`;

    const completion = await ai.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.8,
    });

    const raw = completion.choices[0].message.content.trim();
    const variations = JSON.parse(raw.replace(/```json|```/g, '').trim());
    res.json({ success: true, data: Array.isArray(variations) ? variations.slice(0, 3) : [] });
  } catch (e) {
    console.error('Content optimizer error:', e.message, e.status || '');
    const message = e.status === 401 ? 'AI service authentication failed. Check API key.'
      : e.status === 429 ? 'AI rate limit reached. Try again in a moment.'
      : 'Failed to generate variations. Please try again.';
    res.status(500).json({ success: false, message });
  }
};
