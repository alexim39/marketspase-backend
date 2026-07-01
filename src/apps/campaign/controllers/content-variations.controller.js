import OpenAI from 'openai';

const ai = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' })
  : null;

export const getContentVariations = async (req, res) => {
  try {
    if (!ai) return res.status(503).json({ success: false, message: 'AI service not configured.' });
    const { title, caption, category } = req.body;
    if (!title || !caption) return res.status(400).json({ success: false, message: 'Title and caption required.' });

    const prompt = `Generate 3 alternative title/caption pairs for this Nigerian ad:
Original Title: "${title}"
Original Caption: "${caption}"
Category: ${category || 'other'}

Return ONLY a JSON array:
[{"variantTitle":"...","variantCaption":"..."}]`;

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
    console.error('Variations error:', e.message);
    res.status(500).json({ success: false, message: 'Failed to generate variations.' });
  }
};
